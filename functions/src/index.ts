import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';
import { randomUUID } from 'node:crypto';
import { generateCalendar } from './ics-generator';
import { isActiveCalendarTokenOwner } from './security';

admin.initializeApp();
const firestore = getFirestore();

function normalizeEmail(email: unknown): string {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRetryableInfrastructureError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const details = error as { code?: unknown; message?: unknown; details?: unknown };
  const text = [details.message, details.details].filter((value): value is string => typeof value === 'string').join(' ').toLowerCase();
  return details.code === 2 || details.code === 14 || /metadata service|deadline exceeded|timed out|temporarily unavailable/.test(text);
}

interface ProjectMembership {
  members: string[];
  memberAddedAt: Record<string, unknown>;
}

/**
 * Callable functions run with Admin SDK privileges, so validate the project
 * shape before changing it. This also turns old/corrupt documents into a
 * useful FAILED_PRECONDITION response instead of an opaque INTERNAL error.
 */
function parseProjectMembership(data: Record<string, unknown>): ProjectMembership {
  const members = data.members;
  if (!Array.isArray(members) || members.length === 0 ||
      members.some((member) => typeof member !== 'string' || !member.trim()) ||
      new Set(members).size !== members.length) {
    throw new functions.https.HttpsError('failed-precondition', 'Project membership data is invalid');
  }
  const memberIds = members as string[];

  if (typeof data.createdBy !== 'string' || !memberIds.includes(data.createdBy)) {
    throw new functions.https.HttpsError('failed-precondition', 'Project owner data is invalid');
  }

  if (data.owners !== undefined &&
      (!Array.isArray(data.owners) || data.owners.length === 0 ||
       data.owners.some((owner) => typeof owner !== 'string' || !memberIds.includes(owner)))) {
    throw new functions.https.HttpsError('failed-precondition', 'Project owner data is invalid');
  }

  const memberAddedAt = data.memberAddedAt === undefined ? {} : data.memberAddedAt;
  if (!isRecord(memberAddedAt) || Object.keys(memberAddedAt).some((member) => !memberIds.includes(member))) {
    throw new functions.https.HttpsError('failed-precondition', 'Project membership timestamps are invalid');
  }

  return { members: memberIds, memberAddedAt };
}

/**
 * Generate a new calendar token for a project
 */
export const generateCalendarToken = functions.https.onCall(async (data, context) => {
  // Verify user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { projectId } = data;
  if (!projectId) {
    throw new functions.https.HttpsError('invalid-argument', 'projectId is required');
  }

  // Verify user has access to this project
  const projectRef = firestore.collection('projects').doc(projectId);
  const projectDoc = await projectRef.get();

  if (!projectDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Project not found');
  }

  const projectData = projectDoc.data();
  if (!projectData?.members?.includes(context.auth.uid)) {
    throw new functions.https.HttpsError('permission-denied', 'User is not a member of this project');
  }

  // Generate a random token
  const token = generateRandomToken();

  // Store token in Firestore
  await firestore.collection('calendar_tokens').doc(token).set({
    projectId,
    userId: context.auth.uid,
    createdAt: FieldValue.serverTimestamp(),
  });

  return { token };
});

/**
 * Accept an invitation and add the authenticated user to the project.
 * This is intentionally a callable function: rules cannot correlate an
 * arbitrary project membership update with one invitation document.
 */
export const acceptInvitation = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }
  const invitationId = typeof data?.invitationId === 'string' ? data.invitationId.trim() : '';
  if (!invitationId) {
    throw new functions.https.HttpsError('invalid-argument', 'invitationId is required');
  }

  const userId = context.auth.uid;
  const authEmail = normalizeEmail(context.auth.token.email);
  if (!authEmail) {
    throw new functions.https.HttpsError('permission-denied', 'Your account does not have an email address');
  }

  const invitationRef = firestore.collection('invitations').doc(invitationId);
  try {
    await firestore.runTransaction(async (transaction) => {
      // Every read is intentionally completed before either document is written.
      const invitationSnapshot = await transaction.get(invitationRef);
      if (!invitationSnapshot.exists) {
        throw new functions.https.HttpsError('not-found', 'Invitation not found');
      }

      const invitation = invitationSnapshot.data()!;
      const projectId = typeof invitation.projectId === 'string' ? invitation.projectId.trim() : '';
      if (!projectId || projectId.includes('/')) {
        throw new functions.https.HttpsError('failed-precondition', 'Invitation project data is invalid');
      }
      if (normalizeEmail(invitation.email) !== authEmail) {
        throw new functions.https.HttpsError('permission-denied', 'Invitation is not addressed to this account');
      }
      if (invitation.status !== 'pending' && invitation.status !== 'accepted') {
        throw new functions.https.HttpsError('failed-precondition', 'Invitation status is invalid');
      }

      const projectRef = firestore.collection('projects').doc(projectId);
      const projectSnapshot = await transaction.get(projectRef);
      if (!projectSnapshot.exists) {
        throw new functions.https.HttpsError('not-found', 'Project not found');
      }
      const project = parseProjectMembership(projectSnapshot.data()!);
      const owners = Array.isArray(projectSnapshot.data()!.owners)
        ? projectSnapshot.data()!.owners as string[]
        : [projectSnapshot.data()!.createdBy as string];
      if (typeof invitation.invitedBy !== 'string' || !owners.includes(invitation.invitedBy)) {
        throw new functions.https.HttpsError('failed-precondition', 'Invitation sender is not a project owner');
      }

      // Keep the accepted invitation as an audit/idempotency record. A retry
      // after a successful commit is a no-op for the same authenticated user.
      if (invitation.status === 'accepted') {
        if (invitation.acceptedBy && invitation.acceptedBy !== userId) {
          throw new functions.https.HttpsError('permission-denied', 'Invitation was accepted by another account');
        }
        if (!project.members.includes(userId)) {
          throw new functions.https.HttpsError('failed-precondition', 'This invitation has already been accepted');
        }
        return;
      }

      const acceptedAt = Timestamp.now();
      if (!project.members.includes(userId)) {
        transaction.update(projectRef, {
          members: [...project.members, userId],
          memberAddedAt: {
            ...project.memberAddedAt,
            [userId]: acceptedAt,
          },
        });
      }
      transaction.update(invitationRef, {
        status: 'accepted',
        acceptedBy: userId,
        acceptedAt,
      });
    });
  } catch (error: unknown) {
    if (error instanceof functions.https.HttpsError) throw error;
    console.error('acceptInvitation failed', {
      invitationId,
      userId,
      authEmail,
      runtime: process.version,
      error,
    });
    const retryable = isRetryableInfrastructureError(error);
    throw new functions.https.HttpsError(
      retryable ? 'unavailable' : 'internal',
      retryable
        ? 'Firebase is temporarily unavailable. Please try again.'
        : 'The invitation could not be accepted right now. Please try again.',
    );
  }

  return { success: true };
});

/**
 * Revoke a calendar token
 */
export const revokeCalendarToken = functions.https.onCall(async (data, context) => {
  // Verify user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { token } = data;
  if (!token) {
    throw new functions.https.HttpsError('invalid-argument', 'token is required');
  }

  // Get token document
  const tokenRef = firestore.collection('calendar_tokens').doc(token);
  const tokenDoc = await tokenRef.get();

  if (!tokenDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Token not found');
  }

  const tokenData = tokenDoc.data();

  // Verify user has access to this token's project
  const projectRef = firestore.collection('projects').doc(tokenData!.projectId);
  const projectDoc = await projectRef.get();

  if (!projectDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Project not found');
  }

  const projectData = projectDoc.data();
  if (!projectData?.members?.includes(context.auth.uid)) {
    throw new functions.https.HttpsError('permission-denied', 'User is not a member of this project');
  }

  // Delete token
  await tokenRef.delete();

  return { success: true };
});

/**
 * List all calendar tokens for a project
 */
export const listCalendarTokens = functions.https.onCall(async (data, context) => {
  // Verify user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { projectId } = data;
  if (!projectId) {
    throw new functions.https.HttpsError('invalid-argument', 'projectId is required');
  }

  // Verify user has access to this project
  const projectRef = firestore.collection('projects').doc(projectId);
  const projectDoc = await projectRef.get();

  if (!projectDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Project not found');
  }

  const projectData = projectDoc.data();
  if (!projectData?.members?.includes(context.auth.uid)) {
    throw new functions.https.HttpsError('permission-denied', 'User is not a member of this project');
  }

  // Get all tokens for this project
  const tokensSnapshot = await firestore
    .collection('calendar_tokens')
    .where('projectId', '==', projectId)
    .get();

  const tokens = tokensSnapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      createdAt: data.createdAt?.toDate()?.toISOString() || null,
    };
  });

  return { tokens };
});

/**
 * HTTP endpoint to serve calendar feed
 * URL format: /calendarFeed/{projectId}/{year}?token={token}
 */
export const calendarFeed = functions.https.onRequest(async (req, res) => {
  // Enable CORS
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  // Parse URL: /projectId/year
  const pathParts = req.path.split('/').filter((p) => p);
  if (pathParts.length !== 2) {
    res.status(400).send('Invalid URL format. Expected: /projectId/year?token=xxx');
    return;
  }

  const [projectId, yearStr] = pathParts;
  const year = parseInt(yearStr, 10);
  const token = req.query.token as string;

  if (!token) {
    res.status(401).send('Missing token parameter');
    return;
  }

  if (isNaN(year)) {
    res.status(400).send('Invalid year');
    return;
  }

  // Verify token
  const tokenRef = firestore.collection('calendar_tokens').doc(token);
  const tokenDoc = await tokenRef.get();

  if (!tokenDoc.exists) {
    res.status(401).send('Invalid token');
    return;
  }

  const tokenData = tokenDoc.data();
  if (tokenData!.projectId !== projectId) {
    res.status(403).send('Token does not match project');
    return;
  }

  // A token is not a permanent authorization grant. Removed members lose
  // feed access immediately, even if their old URL is still subscribed.
  const projectDoc = await firestore.collection('projects').doc(projectId).get();
  if (!projectDoc.exists || !isActiveCalendarTokenOwner(projectDoc.data()?.members, tokenData!.userId)) {
    res.status(403).send('Token owner is no longer a project member');
    return;
  }

  // Get season data
  const seasonRef = firestore.collection('seasons').doc(`${projectId}_${year}`);
  const seasonDoc = await seasonRef.get();

  if (!seasonDoc.exists) {
    res.status(404).send('Season not found');
    return;
  }

  const seasonData = seasonDoc.data();

  // Generate ICS calendar
  const icsContent = generateCalendar(seasonData as unknown as Parameters<typeof generateCalendar>[0]);

  if (!icsContent) {
    res.status(500).send('Error generating calendar');
    return;
  }

  // Return ICS file
  res.set('Content-Type', 'text/calendar; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="vineyard-calendar-${year}.ics"`);
  res.status(200).send(icsContent);
});

/**
 * Generate a random token string
 */
function generateRandomToken(): string {
  return randomUUID();
}
