import test from 'node:test';
import assert from 'node:assert/strict';

const projectId = 'demo-vineyard';
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

  const accepted = await callFunction('acceptInvitation', { invitationId }, invitee.idToken);
  assert.equal(accepted.response.status, 200, JSON.stringify(accepted.body));
  assert.deepEqual(accepted.body.data, { success: true });

  const project = await readFirestoreDocument('projects', scopedProjectId, invitee.idToken);
  assert.equal(project.response.status, 200, JSON.stringify(project.body));
  const members = project.body.fields.members.arrayValue.values.map((value) => value.stringValue);
  assert.deepEqual(members.sort(), [owner.localId, invitee.localId].sort());
  const invitation = await readFirestoreDocument('invitations', invitationId, invitee.idToken);
  assert.equal(invitation.response.status, 403);
});
