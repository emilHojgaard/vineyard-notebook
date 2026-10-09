import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  FieldPath,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  Timestamp,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
  type QuerySnapshot,
} from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { auth, db } from '../firebase';
import { invitationsCollection, memberProfileDocument } from '../firestore-repositories';
import { normalizeEmail } from '../utils';

export interface PendingInvitation {
  id: string;
  projectId: string;
  projectName: string;
  email: string;
  invitedBy: string;
}

function pendingInvitationFromDoc(inviteDoc: Pick<QueryDocumentSnapshot<DocumentData>, 'id' | 'data'>): PendingInvitation {
  const invitation = inviteDoc.data();
  return {
    id: inviteDoc.id,
    projectId: invitation.projectId,
    projectName: typeof invitation.projectName === 'string' && invitation.projectName.trim()
      ? invitation.projectName
      : 'Unknown Project',
    email: invitation.email,
    invitedBy: invitation.invitedBy,
  };
}

/** Firestore operations owned by authentication and invitation flows. */
export async function ensureUserProfile(user: Pick<FirebaseUser, 'uid' | 'email'> & { displayName?: string | null }) {
  const userRef = doc(db, 'users', user.uid);
  const snapshot = await getDoc(userRef);
  if (!snapshot.exists()) {
    await setDoc(userRef, {
      email: normalizeEmail(user.email),
      displayName: user.displayName || 'User',
    });
  }
}

export async function saveUserProfile(user: Pick<FirebaseUser, 'uid'>, email: string, displayName: string): Promise<void> {
  await setDoc(doc(db, 'users', user.uid), {
    email: normalizeEmail(email),
    displayName,
  });
}

function pendingInvitationsQuery(email: string) {
  return query(
    collection(db, 'invitations'),
    where('email', '==', normalizeEmail(email)),
    where('status', '==', 'pending'),
  );
}

function pendingInvitationsFromSnapshot(snapshot: QuerySnapshot<DocumentData>): PendingInvitation[] {
  return snapshot.docs.map(pendingInvitationFromDoc);
}

export async function loadPendingInvitations(email: string): Promise<PendingInvitation[]> {
  if (!normalizeEmail(email)) return [];
  const snapshot = await getDocs(pendingInvitationsQuery(email));
  return pendingInvitationsFromSnapshot(snapshot);
}

/** Keep a signed-in invitee's prompt current without exposing other invitations. */
export function subscribeUserPendingInvitations(
  email: string,
  onInvitations: (invitations: PendingInvitation[]) => void,
  onError?: (error: Error) => void,
): () => void {
  if (!normalizeEmail(email)) return () => undefined;
  return onSnapshot(
    pendingInvitationsQuery(email),
    (snapshot) => onInvitations(pendingInvitationsFromSnapshot(snapshot)),
    onError,
  );
}

export async function acceptInvitation(invitation: PendingInvitation): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('You must be signed in to accept an invitation');

  const invitationRef = doc(db, 'invitations', invitation.id);
  await runTransaction(db, async (transaction) => {
    const invitationSnapshot = await transaction.get(invitationRef);
    if (!invitationSnapshot.exists()) throw new Error('Invitation not found');

    const invitationData = invitationSnapshot.data();
    if (invitationData.projectId !== invitation.projectId) {
      throw new Error('Invitation project does not match the selected invitation');
    }

    const projectRef = doc(db, 'projects', invitationData.projectId);

    // Invitees are not project members yet, so rules intentionally do not let
    // them read the project. Array/map transforms let the rules evaluate the
    // complete post-transaction project with getAfter instead.
    if (invitationData.status === 'accepted' && invitationData.acceptedBy === user.uid) return;
    if (invitationData.status !== 'pending') throw new Error('This invitation is no longer available');

    const acceptedAt = Timestamp.now();
    transaction.update(
      projectRef,
      'members', arrayUnion(user.uid),
      new FieldPath('memberAddedAt', user.uid), acceptedAt,
      'lastAcceptedInvitationId', invitation.id,
    );
    transaction.set(memberProfileDocument(invitationData.projectId, user.uid), {
      email: invitationData.email,
      displayName: user.displayName || 'User',
    });
    transaction.update(invitationRef, {
      status: 'accepted',
      acceptedBy: user.uid,
      acceptedAt,
    });
  });
}

export async function declineInvitation(invitationId: string): Promise<void> {
  await deleteDoc(doc(db, 'invitations', invitationId));
}

export async function createInvitation(projectId: string, email: string, invitedBy: string, projectName: string): Promise<void> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) throw new Error('Email address is required');
  const existingInvites = await getDocs(query(
    invitationsCollection(),
    where('projectId', '==', projectId),
    where('email', '==', normalizedEmail),
    where('status', '==', 'pending'),
  ));
  if (!existingInvites.empty) throw new Error('User is already invited');

  await setDoc(doc(invitationsCollection()), {
    projectId,
    projectName: projectName.trim() || 'Unknown Project',
    email: normalizedEmail,
    invitedBy,
    createdAt: Timestamp.now(),
    status: 'pending',
  });
}

export async function deleteInvitation(invitationId: string): Promise<void> {
  await deleteDoc(doc(db, 'invitations', invitationId));
}

export function subscribeProjectInvitations(
  projectId: string,
  onInvitations: (invitations: Array<{
    id: string;
    projectId: string;
    projectName: string;
    email: string;
    invitedBy: string;
    createdAt: string;
    status: 'pending' | 'accepted';
  }>) => void,
  onError?: (error: Error) => void,
): () => void {
  return onSnapshot(query(
    invitationsCollection(),
    where('projectId', '==', projectId),
    where('status', '==', 'pending'),
  ), (snapshot) => {
    onInvitations(snapshot.docs.map((inviteDoc) => ({
      id: inviteDoc.id,
      ...inviteDoc.data(),
      createdAt: inviteDoc.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    })) as Array<{
      id: string;
      projectId: string;
      projectName: string;
      email: string;
      invitedBy: string;
      createdAt: string;
      status: 'pending' | 'accepted';
    }>);
  }, onError);
}
