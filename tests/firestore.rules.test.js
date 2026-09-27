import fs from 'node:fs';
import test from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc, writeBatch } from 'firebase/firestore';

const projectId = 'demo-vineyard';
let testEnv;

test.before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: fs.readFileSync('firestore.rules', 'utf8'),
    },
    storage: {
      rules: fs.readFileSync('storage.rules', 'utf8'),
    },
  });

  await seedTestData();
});

async function seedTestData() {
  await testEnv.clearFirestore();
  await testEnv.clearStorage();
  await testEnv.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'projects', projectId), {
      name: 'Test Vineyard',
      members: ['owner-1', 'member-1'],
      owners: ['owner-1'],
      createdBy: 'owner-1',
      memberAddedAt: {
        'owner-1': new Date(0),
        'member-1': new Date(1),
      },
    });
    await setDoc(doc(db, 'seasons', `${projectId}_2026`), {
      projectId,
      status: 'current',
      title: '2026',
      structure: [],
      content: {},
      locked: true,
      revision: 1,
    });
    await setDoc(doc(db, 'inventory', `${projectId}_2026`), {
      projectId,
      year: 2026,
      sections: [],
      structure: [],
      revision: 1,
    });
    await setDoc(doc(db, 'library', projectId), { projectId, sections: [], revision: 1 });
  });
}

test.beforeEach(seedTestData);

test.after(async () => {
  await testEnv.cleanup();
});

test('a new signed-in user can create a project and its initial records atomically', async () => {
  const userId = 'new-user';
  const newProjectId = 'new-project';
  const year = 2027;
  const newUserDb = testEnv.authenticatedContext(userId).firestore();
  const batch = writeBatch(newUserDb);
  batch.set(doc(newUserDb, 'projects', newProjectId), {
    name: 'New Vineyard',
    members: [userId],
    owners: [userId],
    createdBy: userId,
    createdAt: new Date(),
    memberAddedAt: { [userId]: new Date() },
  });
  batch.set(doc(newUserDb, 'seasons', `${newProjectId}_${year}`), {
    projectId: newProjectId,
    status: 'current',
    title: String(year),
    structure: [],
    content: {},
    locked: false,
    revision: 1,
  });
  batch.set(doc(newUserDb, 'inventory', `${newProjectId}_${year}`), {
    projectId: newProjectId,
    year,
    sections: [],
    structure: [],
    revision: 1,
  });
  batch.set(doc(newUserDb, 'library', newProjectId), {
    projectId: newProjectId,
    sections: [],
    revision: 1,
  });

  await assertSucceeds(batch.commit());
});

test('non-members cannot create or mutate project-scoped records', async () => {
  const outsiderDb = testEnv.authenticatedContext('outsider-1').firestore();
  const year = 2027;

  await assertFails(setDoc(doc(outsiderDb, 'seasons', `${projectId}_${year}`), {
    projectId,
    status: 'current',
    title: String(year),
    structure: [],
    content: {},
    revision: 1,
  }));
  await assertFails(setDoc(doc(outsiderDb, 'inventory', `${projectId}_${year}`), {
    projectId,
    year,
    sections: [],
    structure: [],
    revision: 1,
  }));
  await assertFails(setDoc(doc(outsiderDb, 'library', 'outsider-project'), {
    projectId: 'outsider-project',
    sections: [],
    revision: 1,
  }));

  await assertFails(updateDoc(doc(outsiderDb, 'seasons', `${projectId}_2026`), {
    content: { outsider: true },
    revision: 2,
  }));
  await assertFails(updateDoc(doc(outsiderDb, 'inventory', `${projectId}_2026`), {
    sections: [],
    structure: [],
    revision: 2,
  }));
  await assertFails(updateDoc(doc(outsiderDb, 'library', projectId), {
    sections: [],
    revision: 2,
  }));
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

test('archived seasons and their inventory are read-only, and partition keys cannot move', async () => {
  const memberDb = testEnv.authenticatedContext('member-1').firestore();
  const season = doc(memberDb, 'seasons', `${projectId}_2026`);
  await assertSucceeds(updateDoc(season, { content: { note: { start: '2026-01-01' } }, revision: 2 }));
  await assertFails(updateDoc(season, { structure: [{ id: 'tampered' }], revision: 3 }));
  await assertFails(updateDoc(doc(memberDb, 'inventory', `${projectId}_2026`), {
    sections: [{ id: 'new-section', items: [] }],
    structure: [{ id: 'new-section', itemIds: [] }],
    revision: 2,
  }));
  await assertSucceeds(updateDoc(season, { status: 'completed', revision: 3 }));
  await assertFails(updateDoc(season, { content: {}, revision: 4 }));
  await assertFails(updateDoc(doc(memberDb, 'inventory', `${projectId}_2026`), {
    projectId: 'another-project',
    revision: 2,
  }));
});

test('stale revisions cannot silently overwrite collaborative data', async () => {
  const memberDb = testEnv.authenticatedContext('member-1').firestore();
  const season = doc(memberDb, 'seasons', `${projectId}_2026`);
  await assertSucceeds(updateDoc(season, { content: { newer: { start: '', end: '' } }, revision: 2 }));
  await assertFails(updateDoc(season, { content: { stale: { start: '', end: '' } }, revision: 2 }));
});

test('legacy season documents can make one guarded migration write', async () => {
  await testEnv.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'seasons', `${projectId}_2025`), {
      projectId, status: 'current', title: '2025', root: [],
    });
  });
  const memberDb = testEnv.authenticatedContext('member-1').firestore();
  const legacy = doc(memberDb, 'seasons', `${projectId}_2025`);
  await assertSucceeds(setDoc(legacy, {
    projectId, status: 'current', title: '2025',
    structure: [], content: {}, locked: true, revision: 1,
  }));
  await assertFails(updateDoc(legacy, { root: [], revision: 2 }));
});

test('members cannot inject membership or mutate invitation ownership', async () => {
  const memberDb = testEnv.authenticatedContext('member-1').firestore();
  await assertFails(updateDoc(doc(memberDb, 'projects', projectId), {
    members: ['owner-1', 'member-1', 'outsider-1'],
    memberAddedAt: {
      'owner-1': new Date(0),
      'member-1': new Date(1),
      'outsider-1': new Date(2),
    },
  }));

  const ownerDb = testEnv.authenticatedContext('owner-1').firestore();
  await assertSucceeds(setDoc(doc(ownerDb, 'invitations/invite-secure'), {
    projectId,
    email: 'invitee@example.com',
    invitedBy: 'owner-1',
    status: 'pending',
  }));
  await assertFails(updateDoc(doc(memberDb, 'invitations/invite-secure'), {
    projectId: 'other-project',
  }));
});

test('a newly created project owner can immediately use both media paths', async () => {
  const ownerId = 'created-owner';
  const newProjectId = 'created-project';
  const ownerDb = testEnv.authenticatedContext(ownerId).firestore();
  await assertSucceeds(setDoc(doc(ownerDb, 'projects', newProjectId), {
    name: 'Created Vineyard',
    members: [ownerId],
    owners: [ownerId],
    createdBy: ownerId,
    memberAddedAt: { [ownerId]: new Date() },
  }));

  const ownerStorage = testEnv.authenticatedContext(ownerId).storage();
  const photo = ownerStorage.ref(`projects/${newProjectId}/photos/phase.jpg`);
  const libraryFile = ownerStorage.ref(`projects/${newProjectId}/library/reference.pdf`);
  await assertSucceeds(photo.putString('phase photo'));
  await assertSucceeds(libraryFile.putString('library file'));
  await assertSucceeds(photo.getDownloadURL());
  await assertSucceeds(libraryFile.getDownloadURL());
});

test('project members can upload and read phase photos, but outsiders cannot', async () => {
  const memberStorage = testEnv.authenticatedContext('member-1').storage();
  const outsiderStorage = testEnv.authenticatedContext('outsider-1').storage();
  const memberFile = memberStorage.ref('projects/demo-vineyard/photos/member.txt');
  const outsiderFile = outsiderStorage.ref('projects/demo-vineyard/photos/outsider.txt');

  await assertSucceeds(memberFile.putString('member data'));
  await assertFails(outsiderFile.putString('outsider data'));
  await assertSucceeds(memberFile.getDownloadURL());
  await assertFails(outsiderStorage.ref('projects/demo-vineyard/photos/member.txt').getDownloadURL());
});

test('project members can upload and read library files, but outsiders cannot', async () => {
  const memberStorage = testEnv.authenticatedContext('member-1').storage();
  const outsiderStorage = testEnv.authenticatedContext('outsider-1').storage();
  const memberFile = memberStorage.ref('projects/demo-vineyard/library/member.pdf');
  const outsiderFile = outsiderStorage.ref('projects/demo-vineyard/library/outsider.pdf');

  await assertSucceeds(memberFile.putString('member library data'));
  await assertFails(outsiderFile.putString('outsider library data'));
  await assertSucceeds(memberFile.getDownloadURL());
  await assertFails(outsiderStorage.ref('projects/demo-vineyard/library/member.pdf').getDownloadURL());
});

test('storage paths outside media collections and unknown projects are denied', async () => {
  const memberStorage = testEnv.authenticatedContext('member-1').storage();
  await assertFails(memberStorage.ref('projects/demo-vineyard/private/member.txt').putString('private data'));
  await assertFails(memberStorage.ref('projects/missing-project/photos/member.txt').putString('private data'));
  await assertFails(memberStorage.ref('projects/missing-project/library/member.pdf').putString('private data'));
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
  await assertFails(updateDoc(doc(invitedDb, 'projects', projectId), {
    members: ['owner-1', 'member-1', 'new-user'],
  }));
  await assertSucceeds(deleteDoc(doc(invitedDb, 'invitations/invite-1')));
});
