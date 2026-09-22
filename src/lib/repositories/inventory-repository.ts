import { collection, deleteDoc, onSnapshot, query, setDoc, where } from 'firebase/firestore';
import type { Inventory } from '../../types';
import { db } from '../firebase';
import { inventoryDocument } from '../firestore-repositories';
import { createDefaultInventory } from './repository-models';

export const defaultInventory = createDefaultInventory;

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
        const year = parseInt(inventoryDoc.id.split('_')[2] || '0');
        if (year) inventory[year] = { sections: inventoryDoc.data().sections || [] };
      });
      onInventory(inventory);
    },
    onError,
  );
}

export async function saveInventory(projectId: string, year: number, inventory: Inventory): Promise<void> {
  await setDoc(inventoryDocument(projectId, year), {
    projectId,
    sections: inventory.sections,
  });
}

export async function deleteInventory(projectId: string, year: number): Promise<void> {
  await deleteDoc(inventoryDocument(projectId, year));
}
