import type { Inventory } from '../../types';

/** Canonical defaults used by both project and season creation. */
export function createDefaultInventory(): Inventory {
  return {
    sections: [
      { id: 'inv1', name: 'Equipment', items: [] },
      { id: 'inv2', name: 'Supplies', items: [] },
      { id: 'inv3', name: 'Chemicals/Additives', items: [] },
    ],
  };
}

export function projectMediaPath(projectId: string, category: 'photos' | 'library', filename: string): string {
  return `projects/${projectId}/${category}/${filename}`;
}
