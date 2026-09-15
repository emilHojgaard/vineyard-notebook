"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listCalendarTokens = exports.revokeCalendarToken = exports.generateCalendarToken = exports.calendarFeed = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const cors_1 = __importDefault(require("cors"));
const ics_generator_1 = require("./ics-generator");
// Initialize CORS with options to allow development and production origins
const corsHandler = (0, cors_1.default)({
    origin: true, // Allows all origins (for calendar clients)
    credentials: true,
});
admin.initializeApp();
/**
 * Validate calendar token and return user ID if valid
 */
async function validateCalendarToken(token, projectId) {
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
    }
    catch (error) {
        console.error('Error validating token:', error);
        return null;
    }
}
/**
 * Check if user is a member of the project
 */
async function isProjectMember(userId, projectId) {
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
    }
    catch (error) {
        console.error('Error checking project membership:', error);
        return false;
    }
}
/**
 * Calendar feed endpoint
 * URL: /calendarFeed/:projectId/:seasonYear?token=xxx
 */
exports.calendarFeed = functions.https.onRequest(async (req, res) => {
    // Handle CORS
    return corsHandler(req, res, async () => {
        // Extract parameters
        const pathParts = req.path.split('/').filter(p => p);
        const projectId = pathParts[0];
        const seasonYear = pathParts[1];
        const token = req.query.token;
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
            const projectName = (projectData === null || projectData === void 0 ? void 0 : projectData.name) || 'Vineyard';
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
            const icsContent = (0, ics_generator_1.generateICS)(seasonData, projectName);
            // Return .ics file
            res.set('Content-Type', 'text/calendar; charset=utf-8');
            res.set('Content-Disposition', `inline; filename="vineyard-${seasonYear}.ics"`);
            res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.status(200).send(icsContent);
        }
        catch (error) {
            console.error('Error generating calendar feed:', error);
            res.status(500).send('Internal server error');
        }
    });
});
/**
 * Generate a new calendar token for a user and project
 * Callable function from the client
 */
exports.generateCalendarToken = functions.https.onCall(async (data, context) => {
    // Verify user is authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated to generate a calendar token');
    }
    const userId = context.auth.uid;
    const { projectId } = data;
    if (!projectId) {
        throw new functions.https.HttpsError('invalid-argument', 'projectId is required');
    }
    // Verify user is a member of the project
    const isMember = await isProjectMember(userId, projectId);
    if (!isMember) {
        throw new functions.https.HttpsError('permission-denied', 'User is not a member of this project');
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
    }
    catch (error) {
        console.error('Error generating calendar token:', error);
        throw new functions.https.HttpsError('internal', 'Failed to generate token');
    }
});
/**
 * Revoke a calendar token
 * Callable function from the client
 */
exports.revokeCalendarToken = functions.https.onCall(async (data, context) => {
    // Verify user is authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated to revoke a calendar token');
    }
    const userId = context.auth.uid;
    const { token } = data;
    if (!token) {
        throw new functions.https.HttpsError('invalid-argument', 'token is required');
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
        if ((tokenData === null || tokenData === void 0 ? void 0 : tokenData.userId) !== userId) {
            throw new functions.https.HttpsError('permission-denied', 'Cannot revoke another user\'s token');
        }
        // Delete the token
        await admin.firestore().collection('calendar_tokens').doc(token).delete();
        return { success: true };
    }
    catch (error) {
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
exports.listCalendarTokens = functions.https.onCall(async (data, context) => {
    // Verify user is authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated to list calendar tokens');
    }
    const userId = context.auth.uid;
    const { projectId } = data;
    if (!projectId) {
        throw new functions.https.HttpsError('invalid-argument', 'projectId is required');
    }
    try {
        const tokensSnapshot = await admin
            .firestore()
            .collection('calendar_tokens')
            .where('userId', '==', userId)
            .where('projectId', '==', projectId)
            .get();
        const tokens = tokensSnapshot.docs.map(doc => {
            var _a;
            return ({
                id: doc.id,
                createdAt: ((_a = doc.data().createdAt) === null || _a === void 0 ? void 0 : _a.toDate().toISOString()) || null,
            });
        });
        return { tokens };
    }
    catch (error) {
        console.error('Error listing calendar tokens:', error);
        throw new functions.https.HttpsError('internal', 'Failed to list tokens');
    }
});
//# sourceMappingURL=index.js.map