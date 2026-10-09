import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  Timestamp,
  where,
  writeBatch,
  setDoc,
} from 'firebase/firestore';
import type { Project, Season, Inventory, Member, Library } from '../../types';
import { db } from '../firebase';
import {
  inventoryDocument,
  libraryDocument,
  memberProfileDocument,
  memberProfilesCollection,
  projectDocument,
  seasonDocument,
} from '../firestore-repositories';

export function subscribeProjects(
  userId: string,
  onProjects: (projects: Project[]) => void,
  onError: (error: Error) => void,
): () => void {
  const projectsQuery = query(collection(db, 'projects'), where('members', 'array-contains', userId));
  return onSnapshot(projectsQuery, (snapshot) => {
    onProjects(snapshot.docs.map((projectDoc) => ({
      id: projectDoc.id,
      ...projectDoc.data(),
      createdAt: projectDoc.data().createdAt?.toDate() || new Date(),
    })) as Project[]);
  }, onError);
}

export interface CreateProjectInput {
  id: string;
  name: string;
  ownerId: string;
  createdAt?: Timestamp;
  season: Season;
  inventory: Inventory;
  library: Library;
  ownerProfile: {
    email: string;
    displayName: string;
  };
}

export async function createProject(input: CreateProjectInput): Promise<void> {
  const batch = writeBatch(db);
  const createdAt = input.createdAt || Timestamp.now();
  batch.set(projectDocument(input.id), {
    name: input.name,
    members: [input.ownerId],
    owners: [input.ownerId],
    createdBy: input.ownerId,
    createdAt,
    memberAddedAt: { [input.ownerId]: createdAt },
  });
  batch.set(seasonDocument(input.id, Number(input.season.title)), {
    ...input.season,
    projectId: input.id,
    revision: 1,
  });
  batch.set(inventoryDocument(input.id, Number(input.season.title)), {
    projectId: input.id,
    year: Number(input.season.title),
    sections: input.inventory.sections,
    structure: input.inventory.sections.map((section) => ({
      id: section.id,
      itemIds: section.items.map((item) => item.id),
    })),
    revision: 1,
  });
  batch.set(libraryDocument(input.id), {
    projectId: input.id,
    sections: input.library.sections,
    revision: 1,
  });
  batch.set(doc(memberProfilesCollection(input.id), input.ownerId), input.ownerProfile);
  await batch.commit();
}

export async function saveMemberProfile(
  projectId: string,
  userId: string,
  email: string,
  displayName: string,
): Promise<void> {
  await setDoc(memberProfileDocument(projectId, userId), {
    email,
    displayName,
  });
}

export async function loadMembers(projectId: string): Promise<Member[]> {
  const projectSnapshot = await getDoc(projectDocument(projectId));
  if (!projectSnapshot.exists()) return [];

  const projectData = projectSnapshot.data();
  const memberIds = (projectData.members || []) as string[];
  const memberAddedAt = projectData.memberAddedAt || {};
  const projectCreatedAt = projectData.createdAt?.toDate?.() || new Date(0);
  const profilesSnapshot = await getDocs(memberProfilesCollection(projectId));
  const profiles = new Map(profilesSnapshot.docs.map((profileDoc) => [profileDoc.id, profileDoc.data()]));

  // Membership is authoritative for who appears in the list. Profiles are a
  // project-scoped, least-privilege presentation cache; a missing profile must
  // never hide a valid member or require access to /users/{userId}.
  return memberIds.map((id, index) => {
    const profile = profiles.get(id) || {};
    const addedAtValue = memberAddedAt[id];
    const addedAt = addedAtValue?.toDate?.() || (addedAtValue instanceof Date
      ? addedAtValue
      : new Date(projectCreatedAt.getTime() + index));
    return {
      id,
      email: typeof profile.email === 'string' ? profile.email : '',
      displayName: typeof profile.displayName === 'string' && profile.displayName
        ? profile.displayName
        : 'Unknown',
      role: (projectData.owners || [projectData.createdBy]).includes(id) ? 'owner' : 'member',
      addedAt,
    } as Member;
  });
}

export async function removeMember(projectId: string, memberId: string, actorId: string): Promise<void> {
  await runTransaction(db, async (transaction) => {
    const projectSnapshot = await transaction.get(projectDocument(projectId));
    if (!projectSnapshot.exists()) return;

    const projectData = projectSnapshot.data();
    const currentMembers = (projectData.members || []) as string[];
    if (!currentMembers.includes(memberId)) return;
    if (projectData.createdBy !== actorId) throw new Error('Only the project owner can remove members');
    if (currentMembers.length <= 1) throw new Error('Cannot remove the final project member');

    const updatedMembers = currentMembers.filter((id) => id !== memberId);
    const existingAddedAt = projectData.memberAddedAt || {};
    const projectCreatedAt = projectData.createdAt?.toDate?.() || new Date(0);
    const memberAddedAt: Record<string, Timestamp> = {};
    currentMembers.forEach((id, index) => {
      const value = existingAddedAt[id];
      const date = value?.toDate?.() || (value instanceof Date ? value : new Date(projectCreatedAt.getTime() + index));
      if (updatedMembers.includes(id)) memberAddedAt[id] = Timestamp.fromDate(date);
    });

    const existingOwners = (projectData.owners || [projectData.createdBy]) as string[];
    const updatedOwners = existingOwners.filter((id) => updatedMembers.includes(id));
    const update: Record<string, unknown> = {
      members: updatedMembers,
      owners: updatedOwners,
      memberAddedAt,
    };
    if (memberId === projectData.createdBy) {
      const newOwner = updatedMembers.reduce((oldest, candidate) => (
        memberAddedAt[candidate].toDate().getTime() < memberAddedAt[oldest].toDate().getTime()
          ? candidate
          : oldest
      ), updatedMembers[0]);
      update.createdBy = newOwner;
      if (!updatedOwners.includes(newOwner)) updatedOwners.push(newOwner);
      update.owners = updatedOwners;
    }
    transaction.update(projectDocument(projectId), update);
  });
}

export async function promoteMemberToOwner(projectId: string, memberId: string): Promise<void> {
  await runTransaction(db, async (transaction) => {
    const projectSnapshot = await transaction.get(projectDocument(projectId));
    if (!projectSnapshot.exists()) throw new Error('Project not found');
    const data = projectSnapshot.data();
    if (!(data.members || []).includes(memberId)) throw new Error('Only project members can become owners');
    const owners = Array.from(new Set([...(data.owners || [data.createdBy]), memberId]));
    transaction.update(projectDocument(projectId), { owners });
  });
}

export async function deleteProject(projectId: string): Promise<void> {
  // A missing project is already in the requested state. This makes retries
  // safe after a successful final commit.
  const projectSnapshot = await getDoc(projectDocument(projectId));
  if (!projectSnapshot.exists()) return;

  // Mark the project before removing its records. Rules use this marker to
  // allow the owner to clean up locked seasons/inventory without granting
  // ordinary owner operations a way around season-lock deletion rules.
  const projectStillExists = await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(projectDocument(projectId));
    if (snapshot.exists() && snapshot.data().deleting !== true) {
      transaction.update(projectDocument(projectId), { deleting: true });
    }
    return snapshot.exists();
  });
  if (!projectStillExists) return;

  // Gather only records explicitly owned by this project. Firestore batches
  // are atomic up to 500 writes; chunking keeps cleanup safe for larger
  // projects while preserving retry/idempotency (the project is deleted last).
  const [seasonSnapshot, inventorySnapshot, invitationSnapshot] = await Promise.all([
    getDocs(query(collection(db, 'seasons'), where('projectId', '==', projectId))),
    getDocs(query(collection(db, 'inventory'), where('projectId', '==', projectId))),
    getDocs(query(collection(db, 'invitations'), where('projectId', '==', projectId))),
  ]);
  const relatedRefs = [
    ...seasonSnapshot.docs.map((item) => item.ref),
    ...inventorySnapshot.docs.map((item) => item.ref),
    ...invitationSnapshot.docs.map((item) => item.ref),
  ];

  for (let index = 0; index < relatedRefs.length; index += 450) {
    const batch = writeBatch(db);
    relatedRefs.slice(index, index + 450).forEach((itemRef) => batch.delete(itemRef));
    await batch.commit();
  }

  // Library and project are exact document paths. Keep the project deletion
  // in the final atomic commit so a failed cleanup can be retried by an owner.
  const finalBatch = writeBatch(db);
  finalBatch.delete(libraryDocument(projectId));
  finalBatch.delete(projectDocument(projectId));
  await finalBatch.commit();
}
