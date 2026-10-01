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
Object.defineProperty(exports, "__esModule", { value: true });
exports.calendarFeed = exports.listCalendarTokens = exports.revokeCalendarToken = exports.acceptInvitation = exports.generateCalendarToken = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const node_crypto_1 = require("node:crypto");
const ics_generator_1 = require("./ics-generator");
const security_1 = require("./security");
admin.initializeApp();
const firestore = (0, firestore_1.getFirestore)();
function normalizeEmail(email) {
    return typeof email === 'string' ? email.trim().toLowerCase() : '';
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isRetryableInfrastructureError(error) {
    if (typeof error !== 'object' || error === null)
        return false;
    const details = error;
    const text = [details.message, details.details].filter((value) => typeof value === 'string').join(' ').toLowerCase();
    return details.code === 2 || details.code === 14 || /metadata service|deadline exceeded|timed out|temporarily unavailable/.test(text);
}
/**
 * Callable functions run with Admin SDK privileges, so validate the project
 * shape before changing it. This also turns old/corrupt documents into a
 * useful FAILED_PRECONDITION response instead of an opaque INTERNAL error.
 */
function parseProjectMembership(data) {
    const members = data.members;
    if (!Array.isArray(members) || members.length === 0 ||
        members.some((member) => typeof member !== 'string' || !member.trim()) ||
        new Set(members).size !== members.length) {
        throw new functions.https.HttpsError('failed-precondition', 'Project membership data is invalid');
    }
    const memberIds = members;
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
exports.generateCalendarToken = functions.https.onCall(async (data, context) => {
    var _a;
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
    if (!((_a = projectData === null || projectData === void 0 ? void 0 : projectData.members) === null || _a === void 0 ? void 0 : _a.includes(context.auth.uid))) {
        throw new functions.https.HttpsError('permission-denied', 'User is not a member of this project');
    }
    // Generate a random token
    const token = generateRandomToken();
    // Store token in Firestore
    await firestore.collection('calendar_tokens').doc(token).set({
        projectId,
        userId: context.auth.uid,
        createdAt: firestore_1.FieldValue.serverTimestamp(),
    });
    return { token };
});
/**
 * Accept an invitation and add the authenticated user to the project.
 * This is intentionally a callable function: rules cannot correlate an
 * arbitrary project membership update with one invitation document.
 */
exports.acceptInvitation = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const invitationId = typeof (data === null || data === void 0 ? void 0 : data.invitationId) === 'string' ? data.invitationId.trim() : '';
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
            const invitation = invitationSnapshot.data();
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
            const project = parseProjectMembership(projectSnapshot.data());
            const owners = Array.isArray(projectSnapshot.data().owners)
                ? projectSnapshot.data().owners
                : [projectSnapshot.data().createdBy];
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
            const acceptedAt = firestore_1.Timestamp.now();
            if (!project.members.includes(userId)) {
                transaction.update(projectRef, {
                    members: [...project.members, userId],
                    memberAddedAt: Object.assign(Object.assign({}, project.memberAddedAt), { [userId]: acceptedAt }),
                });
            }
            transaction.update(invitationRef, {
                status: 'accepted',
                acceptedBy: userId,
                acceptedAt,
            });
        });
    }
    catch (error) {
        if (error instanceof functions.https.HttpsError)
            throw error;
        console.error('acceptInvitation failed', {
            invitationId,
            userId,
            authEmail,
            runtime: process.version,
            error,
        });
        const retryable = isRetryableInfrastructureError(error);
        throw new functions.https.HttpsError(retryable ? 'unavailable' : 'internal', retryable
            ? 'Firebase is temporarily unavailable. Please try again.'
            : 'The invitation could not be accepted right now. Please try again.');
    }
    return { success: true };
});
/**
 * Revoke a calendar token
 */
exports.revokeCalendarToken = functions.https.onCall(async (data, context) => {
    var _a;
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
    const projectRef = firestore.collection('projects').doc(tokenData.projectId);
    const projectDoc = await projectRef.get();
    if (!projectDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Project not found');
    }
    const projectData = projectDoc.data();
    if (!((_a = projectData === null || projectData === void 0 ? void 0 : projectData.members) === null || _a === void 0 ? void 0 : _a.includes(context.auth.uid))) {
        throw new functions.https.HttpsError('permission-denied', 'User is not a member of this project');
    }
    // Delete token
    await tokenRef.delete();
    return { success: true };
});
/**
 * List all calendar tokens for a project
 */
exports.listCalendarTokens = functions.https.onCall(async (data, context) => {
    var _a;
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
    if (!((_a = projectData === null || projectData === void 0 ? void 0 : projectData.members) === null || _a === void 0 ? void 0 : _a.includes(context.auth.uid))) {
        throw new functions.https.HttpsError('permission-denied', 'User is not a member of this project');
    }
    // Get all tokens for this project
    const tokensSnapshot = await firestore
        .collection('calendar_tokens')
        .where('projectId', '==', projectId)
        .get();
    const tokens = tokensSnapshot.docs.map((doc) => {
        var _a, _b;
        const data = doc.data();
        return {
            id: doc.id,
            createdAt: ((_b = (_a = data.createdAt) === null || _a === void 0 ? void 0 : _a.toDate()) === null || _b === void 0 ? void 0 : _b.toISOString()) || null,
        };
    });
    return { tokens };
});
/**
 * HTTP endpoint to serve calendar feed
 * URL format: /calendarFeed/{projectId}/{year}?token={token}
 */
exports.calendarFeed = functions.https.onRequest(async (req, res) => {
    var _a;
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
    const token = req.query.token;
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
    if (tokenData.projectId !== projectId) {
        res.status(403).send('Token does not match project');
        return;
    }
    // A token is not a permanent authorization grant. Removed members lose
    // feed access immediately, even if their old URL is still subscribed.
    const projectDoc = await firestore.collection('projects').doc(projectId).get();
    if (!projectDoc.exists || !(0, security_1.isActiveCalendarTokenOwner)((_a = projectDoc.data()) === null || _a === void 0 ? void 0 : _a.members, tokenData.userId)) {
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
    const icsContent = (0, ics_generator_1.generateCalendar)(seasonData);
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
function generateRandomToken() {
    return (0, node_crypto_1.randomUUID)();
}
//# sourceMappingURL=index.js.map