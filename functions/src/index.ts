import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { generateCalendar } from './ics-generator';
import { isActiveCalendarTokenOwner } from './security';

admin.initializeApp();

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
  const projectRef = admin.firestore().collection('projects').doc(projectId);
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
  await admin.firestore().collection('calendar_tokens').doc(token).set({
    projectId,
    userId: context.auth.uid,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
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
  const invitationId = typeof data?.invitationId === 'string' ? data.invitationId : '';
  if (!invitationId) {
    throw new functions.https.HttpsError('invalid-argument', 'invitationId is required');
  }

  const invitationRef = admin.firestore().collection('invitations').doc(invitationId);
  const projectRefForInvitation = admin.firestore().collection('projects');
  await admin.firestore().runTransaction(async (transaction) => {
    const invitationSnapshot = await transaction.get(invitationRef);
    if (!invitationSnapshot.exists) {
      throw new functions.https.HttpsError('not-found', 'Invitation not found');
    }
    const invitation = invitationSnapshot.data()!;
    const authEmail = (context.auth!.token.email || '').toLowerCase();
    if (invitation.status !== 'pending' ||
        typeof invitation.email !== 'string' ||
        invitation.email.toLowerCase() !== authEmail) {
      throw new functions.https.HttpsError('permission-denied', 'Invitation is not addressed to this account');
    }

    const projectRef = projectRefForInvitation.doc(invitation.projectId);
    const projectSnapshot = await transaction.get(projectRef);
    if (!projectSnapshot.exists) {
      throw new functions.https.HttpsError('not-found', 'Project not found');
    }
    const project = projectSnapshot.data()!;
    const members = Array.isArray(project.members) ? project.members as string[] : [];
    if (!members.includes(context.auth!.uid)) {
      transaction.update(projectRef, {
        members: [...members, context.auth!.uid],
        memberAddedAt: {
          ...(project.memberAddedAt || {}),
          [context.auth!.uid]: admin.firestore.Timestamp.now(),
        },
      });
    }
    transaction.delete(invitationRef);
  });

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
  const tokenRef = admin.firestore().collection('calendar_tokens').doc(token);
  const tokenDoc = await tokenRef.get();

  if (!tokenDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Token not found');
  }

  const tokenData = tokenDoc.data();

  // Verify user has access to this token's project
  const projectRef = admin.firestore().collection('projects').doc(tokenData!.projectId);
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
  const projectRef = admin.firestore().collection('projects').doc(projectId);
  const projectDoc = await projectRef.get();

  if (!projectDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Project not found');
  }

  const projectData = projectDoc.data();
  if (!projectData?.members?.includes(context.auth.uid)) {
    throw new functions.https.HttpsError('permission-denied', 'User is not a member of this project');
  }

  // Get all tokens for this project
  const tokensSnapshot = await admin.firestore()
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
  const tokenRef = admin.firestore().collection('calendar_tokens').doc(token);
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
  const projectDoc = await admin.firestore().collection('projects').doc(projectId).get();
  if (!projectDoc.exists || !isActiveCalendarTokenOwner(projectDoc.data()?.members, tokenData!.userId)) {
    res.status(403).send('Token owner is no longer a project member');
    return;
  }

  // Get season data
  const seasonRef = admin.firestore().collection('seasons').doc(`${projectId}_${year}`);
  const seasonDoc = await seasonRef.get();

  if (!seasonDoc.exists) {
    res.status(404).send('Season not found');
    return;
  }

  const seasonData = seasonDoc.data();

  // Generate ICS calendar
  const icsContent = generateCalendar(seasonData as any);

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
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}
