import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { generateICS } from './ics-generator';

admin.initializeApp();

/**
 * Validate calendar token and return user ID if valid
 */
async function validateCalendarToken(
  token: string,
  projectId: string
): Promise<string | null> {
  try {
    const tokenDoc = await admin
      .firestore()
      .collection('calendar_tokens')
      .doc(token)
      .get();

    if (!tokenDoc.exists) {
      return null;
    }

    const tokenData = tokenDoc.data();
    if (!tokenData) {
      return null;
    }

    // Check if token is for the correct project
    if (tokenData.projectId !== projectId) {
      return null;
    }

    // Check if token is expired (optional: add expiration logic here)
    // For now, tokens are long-lived

    return tokenData.userId;
  } catch (error) {
    console.error('Error validating token:', error);
    return null;
  }
}

/**
 * Check if user is a member of the project
 */
async function isProjectMember(
  userId: string,
  projectId: string
): Promise<boolean> {
  try {
    const projectDoc = await admin
      .firestore()
      .collection('projects')
      .doc(projectId)
      .get();

    if (!projectDoc.exists) {
      return false;
    }

    const projectData = projectDoc.data();
    if (!projectData) {
      return false;
    }

    return projectData.members.includes(userId);
  } catch (error) {
    console.error('Error checking project membership:', error);
    return false;
  }
}

/**
 * Calendar feed endpoint
 * URL: /calendarFeed/:projectId/:seasonYear?token=xxx
 */
export const calendarFeed = functions.https.onRequest(async (req, res) => {
  // Enable CORS for calendar clients
  res.set('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).send('');
    return;
  }

  // Extract parameters
  const pathParts = req.path.split('/').filter(p => p);
  const projectId = pathParts[0];
  const seasonYear = pathParts[1];
  const token = req.query.token as string;

  // Validate inputs
  if (!projectId || !seasonYear || !token) {
    res.status(400).send('Missing required parameters: projectId, seasonYear, or token');
    return;
  }

  // Validate token
  const userId = await validateCalendarToken(token, projectId);
  if (!userId) {
    res.status(403).send('Invalid or expired token');
    return;
  }

  // Verify user is a project member
  const isMember = await isProjectMember(userId, projectId);
  if (!isMember) {
    res.status(403).send('User is not a member of this project');
    return;
  }

  try {
    // Fetch project data
    const projectDoc = await admin
      .firestore()
      .collection('projects')
      .doc(projectId)
      .get();

    if (!projectDoc.exists) {
      res.status(404).send('Project not found');
      return;
    }

    const projectData = projectDoc.data();
    const projectName = projectData?.name || 'Vineyard';

    // Fetch season data
    const seasonId = `${projectId}_${seasonYear}`;
    const seasonDoc = await admin
      .firestore()
      .collection('seasons')
      .doc(seasonId)
      .get();

    if (!seasonDoc.exists) {
      res.status(404).send('Season not found');
      return;
    }

    const seasonData = seasonDoc.data();
    if (!seasonData) {
      res.status(404).send('Season data is empty');
      return;
    }

    // Generate .ics file
    const icsContent = generateICS(seasonData as any, projectName);

    // Return .ics file
    res.set('Content-Type', 'text/calendar; charset=utf-8');
    res.set('Content-Disposition', `inline; filename="vineyard-${seasonYear}.ics"`);
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.status(200).send(icsContent);
  } catch (error) {
    console.error('Error generating calendar feed:', error);
    res.status(500).send('Internal server error');
  }
});

/**
 * Generate a new calendar token for a user and project
 * Callable function from the client
 */
export const generateCalendarToken = functions.https.onCall(async (data, context) => {
  // Verify user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Must be authenticated to generate a calendar token'
    );
  }

  const userId = context.auth.uid;
  const { projectId } = data;

  if (!projectId) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'projectId is required'
    );
  }

  // Verify user is a member of the project
  const isMember = await isProjectMember(userId, projectId);
  if (!isMember) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'User is not a member of this project'
    );
  }

  try {
    // Generate a unique token
    const tokenId = admin.firestore().collection('calendar_tokens').doc().id;

    // Store token in Firestore
    await admin
      .firestore()
      .collection('calendar_tokens')
      .doc(tokenId)
      .set({
        userId,
        projectId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    return { token: tokenId };
  } catch (error) {
    console.error('Error generating calendar token:', error);
    throw new functions.https.HttpsError('internal', 'Failed to generate token');
  }
});

/**
 * Revoke a calendar token
 * Callable function from the client
 */
export const revokeCalendarToken = functions.https.onCall(async (data, context) => {
  // Verify user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Must be authenticated to revoke a calendar token'
    );
  }

  const userId = context.auth.uid;
  const { token } = data;

  if (!token) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'token is required'
    );
  }

  try {
    const tokenDoc = await admin
      .firestore()
      .collection('calendar_tokens')
      .doc(token)
      .get();

    if (!tokenDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Token not found');
    }

    const tokenData = tokenDoc.data();
    if (tokenData?.userId !== userId) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Cannot revoke another user\'s token'
      );
    }

    // Delete the token
    await admin.firestore().collection('calendar_tokens').doc(token).delete();

    return { success: true };
  } catch (error) {
    console.error('Error revoking calendar token:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', 'Failed to revoke token');
  }
});

/**
 * List all calendar tokens for the current user and a specific project
 * Callable function from the client
 */
export const listCalendarTokens = functions.https.onCall(async (data, context) => {
  // Verify user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Must be authenticated to list calendar tokens'
    );
  }

  const userId = context.auth.uid;
  const { projectId } = data;

  if (!projectId) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'projectId is required'
    );
  }

  try {
    const tokensSnapshot = await admin
      .firestore()
      .collection('calendar_tokens')
      .where('userId', '==', userId)
      .where('projectId', '==', projectId)
      .get();

    const tokens = tokensSnapshot.docs.map(doc => ({
      id: doc.id,
      createdAt: doc.data().createdAt?.toDate().toISOString() || null,
    }));

    return { tokens };
  } catch (error) {
    console.error('Error listing calendar tokens:', error);
    throw new functions.https.HttpsError('internal', 'Failed to list tokens');
  }
});
