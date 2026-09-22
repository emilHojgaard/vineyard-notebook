import { collection, onSnapshot, query, runTransaction, where } from 'firebase/firestore';
import type { Inventory } from '../../types';
import { db } from '../firebase';
import { inventoryDocument } from '../firestore-repositories';
import { createDefaultInventory } from './repository-models';
import { ConcurrentWriteError } from './seasons-repository';

export const defaultInventory = createDefaultInventory;

export function inventoryStructure(inventory: Inventory) {
  return inventory.sections.map((section) => ({
    id: section.id,
    itemIds: section.items.map((item) => item.id),
  }));
}

export function subscribeInventory(
  projectId: string,
  onInventory: (inventory: Record<number, Inventory>) => void,
  onError: (error: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(db, 'inventory'), where('projectId', '==', projectId)),
    (snapshot) => {
      const inventory: Record<number, Inventory> = {};
      snapshot.docs.forEach((inventoryDoc) => {
        const data = inventoryDoc.data();
        const year = Number(data.year) || parseInt(inventoryDoc.id.split('_').pop() || '0', 10);
        if (year) inventory[year] = {
          sections: data.sections || [],
          revision: data.revision || 0,
        };
      });
      onInventory(inventory);
    },
    onError,
  );
}

export async function saveInventory(
  projectId: string,
  year: number,
  inventory: Inventory,
  expectedRevision?: number,
): Promise<Inventory> {
  const ref = inventoryDocument(projectId, year);
  let saved: Inventory;
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    const currentRevision = snapshot.exists() ? (snapshot.data().revision || 0) : 0;
    if (snapshot.exists() && expectedRevision !== currentRevision) {
      throw new ConcurrentWriteError(`Inventory ${year}`);
    }
    if (!snapshot.exists() && expectedRevision !== undefined) {
      throw new ConcurrentWriteError(`Inventory ${year}`);
    }
    saved = { sections: inventory.sections, revision: currentRevision + 1 };
    transaction.set(ref, {
      projectId,
      year,
      sections: saved.sections,
      structure: inventoryStructure(inventory),
      revision: saved.revision,
    });
  });
  return saved!;
}

export async function deleteInventory(projectId: string, year: number, expectedRevision?: number): Promise<void> {
  const ref = inventoryDocument(projectId, year);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) return;
    if ((snapshot.data().revision || 0) !== expectedRevision) {
      throw new ConcurrentWriteError(`Inventory ${year}`);
    }
    transaction.delete(ref);
  });
}
