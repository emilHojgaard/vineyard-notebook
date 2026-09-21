import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const projectId = 'demo-vineyard';
const projectRef = docId => `projects/${projectId}`;

let testEnv;

test.before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: fs.readFileSync('firestore.rules', 'utf8'),
    },
  });

  await seedTestData();
});

async function seedTestData() {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'projects', projectId), {
      name: 'Test Vineyard',
      members: ['owner-1', 'member-1'],
      owners: ['owner-1'],
      createdBy: 'owner-1',
    });
    await setDoc(doc(db, 'seasons', `${projectId}_2026`), {
      projectId,
      status: 'current',
      title: '2026',
      root: [],
    });
    await setDoc(doc(db, 'inventory', `${projectId}_2026`), {
      projectId,
      sections: [],
    });
    await setDoc(doc(db, 'library', projectId), { sections: [] });
  });
}

test.beforeEach(seedTestData);

test.after(async () => {
  await testEnv.cleanup();
});

test('project members can read project-scoped data', async () => {
  const memberDb = testEnv.authenticatedContext('member-1').firestore();
  await assertSucceeds(getDoc(doc(memberDb, 'seasons', `${projectId}_2026`)));
  await assertSucceeds(getDoc(doc(memberDb, 'inventory', `${projectId}_2026`)));
  await assertSucceeds(getDoc(doc(memberDb, 'library', projectId)));
});

test('non-members cannot read project-scoped data', async () => {
  const outsiderDb = testEnv.authenticatedContext('outsider-1').firestore();
  await assertFails(getDoc(doc(outsiderDb, 'seasons', `${projectId}_2026`)));
  await assertFails(getDoc(doc(outsiderDb, 'inventory', `${projectId}_2026`)));
  await assertFails(getDoc(doc(outsiderDb, 'library', projectId)));
});

test('only owners can change membership and owners can promote members', async () => {
  const memberDb = testEnv.authenticatedContext('member-1').firestore();
  await assertFails(updateDoc(doc(memberDb, 'projects', projectId), {
    owners: ['member-1'],
  }));

  const ownerDb = testEnv.authenticatedContext('owner-1').firestore();
  await assertSucceeds(updateDoc(doc(ownerDb, 'projects', projectId), {
    owners: ['owner-1', 'member-1'],
  }));
});

test('only owners can create invitations and invited email can read its invitation', async () => {
  const memberDb = testEnv.authenticatedContext('member-1').firestore();
  const invitation = doc(memberDb, 'invitations/invite-1');
  await assertFails(setDoc(invitation, {
    projectId,
    email: 'new@example.com',
    invitedBy: 'member-1',
    status: 'pending',
  }));

  const ownerDb = testEnv.authenticatedContext('owner-1').firestore();
  await assertSucceeds(setDoc(doc(ownerDb, 'invitations/invite-1'), {
    projectId,
    email: 'new@example.com',
    invitedBy: 'owner-1',
    status: 'pending',
  }));

  const invitedDb = testEnv.authenticatedContext('new-user', { email: 'new@example.com' }).firestore();
  await assertSucceeds(getDoc(doc(invitedDb, 'invitations/invite-1')));
});
