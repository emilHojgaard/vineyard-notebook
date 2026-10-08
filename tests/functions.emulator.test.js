import test from 'node:test';
import assert from 'node:assert/strict';
import admin from '../functions/node_modules/firebase-admin/lib/index.js';

const projectId = 'demo-vineyard';
admin.initializeApp({ projectId });
const adminDb = admin.firestore();
const authUrl = process.env.AUTH_EMULATOR_URL ?? 'http://127.0.0.1:9099';
const firestoreUrl = process.env.FIRESTORE_EMULATOR_URL ?? 'http://127.0.0.1:8080';
const functionsUrl = process.env.FUNCTIONS_EMULATOR_URL ?? 'http://127.0.0.1:5001';

async function createUser(email) {
  const response = await fetch(
    `${authUrl}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'password123', returnSecureToken: true }),
    },
  );
  const body = await response.text();
  assert.equal(response.ok, true, body);
  return JSON.parse(body);
}

async function writeFirestoreDocument(collection, id, fields, idToken) {
  const response = await fetch(
    `${firestoreUrl}/v1/projects/${projectId}/databases/(default)/documents/${collection}/${id}`,
    {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ fields }),
    },
  );
  assert.equal(response.ok, true, await response.text());
}

async function readFirestoreDocument(collection, id, idToken) {
  const response = await fetch(
    `${firestoreUrl}/v1/projects/${projectId}/databases/(default)/documents/${collection}/${id}`,
    { headers: { authorization: `Bearer ${idToken}` } },
  );
  return { response, body: await response.json() };
}

async function callFunction(name, data, idToken) {
  const headers = { 'content-type': 'application/json' };
  if (idToken) headers.authorization = `Bearer ${idToken}`;
  const response = await fetch(`${functionsUrl}/${projectId}/us-central1/${name}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ data }),
  });
  const body = await response.json();
  if (body.result && !body.data) body.data = body.result;
  return { response, body };
}

test('health endpoint reports the Admin Firestore transport status safely', async () => {
  const response = await fetch(`${functionsUrl}/${projectId}/us-central1/health`);
  const body = await response.json();
  assert.equal(response.status, 200, JSON.stringify(body));
  assert.deepEqual(body, { status: 'ok' });

  const unsupported = await fetch(`${functionsUrl}/${projectId}/us-central1/health`, { method: 'POST' });
  assert.equal(unsupported.status, 405);
  assert.deepEqual(await unsupported.json(), { status: 'method_not_allowed' });
});

test('callable functions enforce authentication in the configured emulator', async () => {
  const result = await callFunction('generateCalendarToken', { projectId: 'missing' });
  assert.equal(result.response.status, 401);
  assert.equal(result.body.error.status, 'UNAUTHENTICATED');
});

test('authenticated callable functions can use the Firestore emulator', async () => {
  const user = await createUser(`calendar-${Date.now()}@example.com`);
  const scopedProjectId = `project-${user.localId}`;
  await writeFirestoreDocument('projects', scopedProjectId, {
    members: { arrayValue: { values: [{ stringValue: user.localId }] } },
    createdBy: { stringValue: user.localId },
  }, user.idToken);

  const generated = await callFunction(
    'generateCalendarToken',
    { projectId: scopedProjectId },
    user.idToken,
  );
  assert.equal(generated.response.status, 200, JSON.stringify(generated.body));
  assert.equal(typeof generated.body.data?.token, 'string', JSON.stringify(generated.body));

  const listed = await callFunction(
    'listCalendarTokens',
    { projectId: scopedProjectId },
    user.idToken,
  );
  assert.equal(listed.response.status, 200, JSON.stringify(listed.body));
  assert.equal(listed.body.data.tokens.length, 1);
  assert.equal(listed.body.data.tokens[0].id, generated.body.data.token);

  const revoked = await callFunction(
    'revokeCalendarToken',
    { token: generated.body.data.token },
    user.idToken,
  );
  assert.deepEqual(revoked.body.data, { success: true });
});

test('callable membership checks reject authenticated non-members', async () => {
  const user = await createUser(`outsider-${Date.now()}@example.com`);
  const result = await callFunction('generateCalendarToken', { projectId: 'not-their-project' }, user.idToken);
  assert.equal(result.response.status, 404);
  assert.equal(result.body.error.status, 'NOT_FOUND');
});

test('invitee can accept a canonical invitation with a differently cased auth email', async () => {
  const suffix = Date.now();
  const owner = await createUser(`owner-${suffix}@example.com`);
  const invitee = await createUser(`Invitee-${suffix}@Example.com`);
  const scopedProjectId = `invite-project-${suffix}`;
  const invitationId = `invite-${suffix}`;

  await writeFirestoreDocument('projects', scopedProjectId, {
    name: { stringValue: 'Invite Vineyard' },
    members: { arrayValue: { values: [{ stringValue: owner.localId }] } },
    owners: { arrayValue: { values: [{ stringValue: owner.localId }] } },
    createdBy: { stringValue: owner.localId },
  }, owner.idToken);
  await writeFirestoreDocument('invitations', invitationId, {
    projectId: { stringValue: scopedProjectId },
    projectName: { stringValue: 'Invite Vineyard' },
    email: { stringValue: `invitee-${suffix}@example.com` },
    invitedBy: { stringValue: owner.localId },
    status: { stringValue: 'pending' },
  }, owner.idToken);

  const concurrentAccepts = await Promise.all([
    callFunction('acceptInvitation', { invitationId }, invitee.idToken),
    callFunction('acceptInvitation', { invitationId }, invitee.idToken),
  ]);
  for (const accepted of concurrentAccepts) {
    assert.equal(accepted.response.status, 200, JSON.stringify(accepted.body));
    assert.deepEqual(accepted.body.data, { success: true });
  }

  const retried = await callFunction('acceptInvitation', { invitationId }, invitee.idToken);
  assert.equal(retried.response.status, 200, JSON.stringify(retried.body));
  assert.deepEqual(retried.body.data, { success: true });

  const project = await readFirestoreDocument('projects', scopedProjectId, invitee.idToken);
  assert.equal(project.response.status, 200, JSON.stringify(project.body));
  const members = project.body.fields.members.arrayValue.values.map((value) => value.stringValue);
  assert.deepEqual(members.sort(), [owner.localId, invitee.localId].sort());
  const invitation = await readFirestoreDocument('invitations', invitationId, invitee.idToken);
  assert.equal(invitation.response.status, 200, JSON.stringify(invitation.body));
  assert.equal(invitation.body.fields.status.stringValue, 'accepted');
  assert.equal(invitation.body.fields.acceptedBy.stringValue, invitee.localId);
});

test('wrong account cannot accept an invitation', async () => {
  const suffix = Date.now();
  const owner = await createUser(`owner-wrong-${suffix}@example.com`);
  const invitee = await createUser(`invitee-wrong-${suffix}@example.com`);
  const wrongAccount = await createUser(`wrong-${suffix}@example.com`);
  const scopedProjectId = `invite-wrong-project-${suffix}`;
  const invitationId = `invite-wrong-${suffix}`;

  await writeFirestoreDocument('projects', scopedProjectId, {
    members: { arrayValue: { values: [{ stringValue: owner.localId }] } },
    owners: { arrayValue: { values: [{ stringValue: owner.localId }] } },
    createdBy: { stringValue: owner.localId },
  }, owner.idToken);
  await writeFirestoreDocument('invitations', invitationId, {
    projectId: { stringValue: scopedProjectId },
    email: { stringValue: invitee.email.toLowerCase() },
    invitedBy: { stringValue: owner.localId },
    status: { stringValue: 'pending' },
  }, owner.idToken);

  const result = await callFunction('acceptInvitation', { invitationId }, wrongAccount.idToken);
  assert.equal(result.response.status, 403, JSON.stringify(result.body));
  assert.equal(result.body.error.status, 'PERMISSION_DENIED');

  const project = await readFirestoreDocument('projects', scopedProjectId, owner.idToken);
  assert.deepEqual(project.body.fields.members.arrayValue.values.map((value) => value.stringValue), [owner.localId]);
  const invitation = await readFirestoreDocument('invitations', invitationId, owner.idToken);
  assert.equal(invitation.body.fields.status.stringValue, 'pending');
});

test('already-accepted invitation cannot be claimed by a different account', async () => {
  const suffix = Date.now();
  const owner = await createUser(`owner-accepted-${suffix}@example.com`);
  const invitee = await createUser(`invitee-accepted-${suffix}@example.com`);
  const acceptedBy = await createUser(`accepted-by-${suffix}@example.com`);
  const scopedProjectId = `invite-accepted-project-${suffix}`;
  const invitationId = `invite-accepted-${suffix}`;

  await adminDb.collection('projects').doc(scopedProjectId).set({
    members: [owner.localId, acceptedBy.localId],
    owners: [owner.localId],
    createdBy: owner.localId,
  });
  await adminDb.collection('invitations').doc(invitationId).set({
    projectId: scopedProjectId,
    email: invitee.email.toLowerCase(),
    invitedBy: owner.localId,
    status: 'accepted',
    acceptedBy: acceptedBy.localId,
  });

  const result = await callFunction('acceptInvitation', { invitationId }, invitee.idToken);
  assert.equal(result.response.status, 403, JSON.stringify(result.body));
  assert.equal(result.body.error.status, 'PERMISSION_DENIED');

  const project = await readFirestoreDocument('projects', scopedProjectId, owner.idToken);
  assert.deepEqual(project.body.fields.members.arrayValue.values.map((value) => value.stringValue), [owner.localId, acceptedBy.localId]);
  const invitation = await readFirestoreDocument('invitations', invitationId, owner.idToken);
  assert.equal(invitation.body.fields.status.stringValue, 'accepted');
  assert.equal(invitation.body.fields.acceptedBy.stringValue, acceptedBy.localId);
});

test('missing invitation returns NOT_FOUND instead of INTERNAL', async () => {
  const user = await createUser(`missing-invite-${Date.now()}@example.com`);
  const result = await callFunction('acceptInvitation', { invitationId: `does-not-exist-${Date.now()}` }, user.idToken);
  assert.equal(result.response.status, 404, JSON.stringify(result.body));
  assert.equal(result.body.error.status, 'NOT_FOUND');
});

test('malformed project membership data is rejected without granting access', async () => {
  const suffix = Date.now();
  const owner = await createUser(`owner-malformed-${suffix}@example.com`);
  const invitee = await createUser(`invitee-malformed-${suffix}@example.com`);
  const scopedProjectId = `invite-malformed-project-${suffix}`;
  const invitationId = `invite-malformed-${suffix}`;

  // This shape passes the legacy Firestore rule but is not a valid membership
  // list for trusted server code: a member ID must always be a string.
  await writeFirestoreDocument('projects', scopedProjectId, {
    members: { arrayValue: { values: [{ stringValue: owner.localId }, { integerValue: '7' }] } },
    owners: { arrayValue: { values: [{ stringValue: owner.localId }] } },
    createdBy: { stringValue: owner.localId },
  }, owner.idToken);
  await writeFirestoreDocument('invitations', invitationId, {
    projectId: { stringValue: scopedProjectId },
    email: { stringValue: invitee.email.toLowerCase() },
    invitedBy: { stringValue: owner.localId },
    status: { stringValue: 'pending' },
  }, owner.idToken);

  const result = await callFunction('acceptInvitation', { invitationId }, invitee.idToken);
  assert.equal(result.response.status, 400, JSON.stringify(result.body));
  assert.equal(result.body.error.status, 'FAILED_PRECONDITION');

  const invitation = await readFirestoreDocument('invitations', invitationId, owner.idToken);
  assert.equal(invitation.body.fields.status.stringValue, 'pending');
});
