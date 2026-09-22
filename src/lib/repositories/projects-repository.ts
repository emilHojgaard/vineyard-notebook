import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import type { Project, Season, Inventory, Member, Library } from '../../types';
import { db } from '../firebase';
import { inventoryDocument, libraryDocument, projectDocument, seasonDocument } from '../firestore-repositories';

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
  await batch.commit();
}

export async function loadMembers(projectId: string): Promise<Member[]> {
  const projectSnapshot = await getDoc(projectDocument(projectId));
  if (!projectSnapshot.exists()) return [];

  const projectData = projectSnapshot.data();
  const memberIds = (projectData.members || []) as string[];
  const memberAddedAt = projectData.memberAddedAt || {};
  const projectCreatedAt = projectData.createdAt?.toDate?.() || new Date(0);
  const memberPromises = memberIds.map(async (id, index) => {
    const userSnapshot = await getDoc(doc(db, 'users', id));
    if (!userSnapshot.exists()) return null;
    const userData = userSnapshot.data();
    const addedAtValue = memberAddedAt[id];
    const addedAt = addedAtValue?.toDate?.() || (addedAtValue instanceof Date
      ? addedAtValue
      : new Date(projectCreatedAt.getTime() + index));
    return {
      id,
      email: userData.email || '',
      displayName: userData.displayName || 'Unknown',
      role: (projectData.owners || [projectData.createdBy]).includes(id) ? 'owner' : 'member',
      addedAt,
    } as Member;
  });
  return (await Promise.all(memberPromises)).filter(Boolean) as Member[];
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
  const deleteCollection = async (collectionName: 'seasons' | 'inventory') => {
    const snapshot = await getDocs(query(
      collection(db, collectionName),
      where('projectId', '==', projectId),
    ));
    await Promise.all(snapshot.docs.map((item) => deleteDoc(item.ref)));
  };
  await deleteCollection('seasons');
  await deleteCollection('inventory');
  await deleteDoc(libraryDocument(projectId));
  await deleteDoc(projectDocument(projectId));
}
