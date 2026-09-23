import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  Timestamp,
  where,
} from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { db, functions } from '../firebase';
import { invitationsCollection, projectDocument } from '../firestore-repositories';
import { httpsCallable } from 'firebase/functions';

export interface PendingInvitation {
  id: string;
  projectId: string;
  projectName: string;
  email: string;
  invitedBy: string;
}

/** Firestore operations owned by authentication and invitation flows. */
export async function ensureUserProfile(user: Pick<FirebaseUser, 'uid' | 'email'> & { displayName?: string | null }) {
  const userRef = doc(db, 'users', user.uid);
  const snapshot = await getDoc(userRef);
  if (!snapshot.exists()) {
    await setDoc(userRef, {
      email: user.email,
      displayName: user.displayName || 'User',
    });
  }
}

export async function saveUserProfile(user: Pick<FirebaseUser, 'uid'>, email: string, displayName: string): Promise<void> {
  await setDoc(doc(db, 'users', user.uid), {
    email: email.toLowerCase(),
    displayName,
  });
}

export async function loadPendingInvitations(email: string): Promise<PendingInvitation[]> {
  const invitationsQuery = query(
    collection(db, 'invitations'),
    where('email', '==', email.toLowerCase()),
    where('status', '==', 'pending'),
  );
  const snapshot = await getDocs(invitationsQuery);
  const invitations: PendingInvitation[] = [];

  for (const inviteDoc of snapshot.docs) {
    const invitation = inviteDoc.data();
    const projectSnapshot = await getDoc(projectDocument(invitation.projectId));
    if (projectSnapshot.exists()) {
      invitations.push({
        id: inviteDoc.id,
        projectId: invitation.projectId,
        projectName: projectSnapshot.data().name || 'Unknown Project',
        email: invitation.email,
        invitedBy: invitation.invitedBy,
      });
    }
  }

  return invitations;
}

export async function acceptInvitation(invitation: PendingInvitation): Promise<void> {
  // Membership addition is deliberately server-side. A Firestore client
  // cannot prove that a project update corresponds to this exact invitation.
  const callable = httpsCallable(functions, 'acceptInvitation');
  await callable({ invitationId: invitation.id });
}

export async function declineInvitation(invitationId: string): Promise<void> {
  await deleteDoc(doc(db, 'invitations', invitationId));
}

export async function createInvitation(projectId: string, email: string, invitedBy: string): Promise<void> {
  const normalizedEmail = email.toLowerCase().trim();
  const existingInvites = await getDocs(query(
    invitationsCollection(),
    where('projectId', '==', projectId),
    where('email', '==', normalizedEmail),
    where('status', '==', 'pending'),
  ));
  if (!existingInvites.empty) throw new Error('User is already invited');

  await setDoc(doc(invitationsCollection()), {
    projectId,
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
    email: string;
    invitedBy: string;
    createdAt: string;
    status: 'pending' | 'accepted';
  }>) => void,
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
      email: string;
      invitedBy: string;
      createdAt: string;
      status: 'pending' | 'accepted';
    }>);
  });
}
