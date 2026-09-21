import type { Node } from '../../types';

export interface InventoryItemIdentity {
  sectionId: string;
  itemId: string;
  itemIndex: number;
}

/**
 * Build the identity used by edit state and React keys.
 *
 * The index is intentional: older Firestore data can contain duplicate item
 * IDs (IDs were generated only in memory), and a raw ID must never cause two
 * rows to share an editing state or DOM key.
 */
export function inventoryItemKey(identity: InventoryItemIdentity): string {
  return `${identity.sectionId}:${identity.itemId}:${identity.itemIndex}`;
}

export interface InventoryEditingState<Draft> {
  editingItemKey: string | null;
  drafts: Record<string, Draft>;
}

/** Select one item without sharing its draft with any other item. */
export function beginInventoryItemEdit<Draft>(
  state: InventoryEditingState<Draft>,
  itemKey: string,
  createDraft: () => Draft,
): InventoryEditingState<Draft> {
  return {
    editingItemKey: itemKey,
    drafts: state.drafts[itemKey]
      ? state.drafts
      : { ...state.drafts, [itemKey]: createDraft() },
  };
}

export function isInventoryItemEditing(
  state: InventoryEditingState<unknown>,
  itemKey: string,
): boolean {
  return state.editingItemKey === itemKey;
}

export function discardInventoryItemDraft<Draft>(
  state: InventoryEditingState<Draft>,
  itemKey: string,
): InventoryEditingState<Draft> {
  const drafts = { ...state.drafts };
  delete drafts[itemKey];

  return {
    editingItemKey: state.editingItemKey === itemKey ? null : state.editingItemKey,
    drafts,
  };
}

/** Replace links for one inventory item without touching another item's links. */
export function updateInventoryItemPhaseLinks(
  nodes: Node[],
  itemId: string,
  selectedPhaseIds: string[],
): void {
  const selected = new Set(selectedPhaseIds);
  const visit = (items: Node[]) => {
    items.forEach((node) => {
      node.invIds = (node.invIds || []).filter((id) => id !== itemId);
      if (selected.has(node.id)) node.invIds.push(itemId);
      if (node.branches) node.branches.forEach((branch) => visit(branch.nodes));
    });
  };
  visit(nodes);
}
