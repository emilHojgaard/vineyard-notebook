export interface InventoryEditingState<Draft> {
  editingItemId: string | null;
  drafts: Record<string, Draft>;
}

/** Select one item without sharing its draft with any other item. */
export function beginInventoryItemEdit<Draft>(
  state: InventoryEditingState<Draft>,
  itemId: string,
  createDraft: () => Draft,
): InventoryEditingState<Draft> {
  return {
    editingItemId: itemId,
    drafts: state.drafts[itemId]
      ? state.drafts
      : { ...state.drafts, [itemId]: createDraft() },
  };
}

export function isInventoryItemEditing(
  state: InventoryEditingState<unknown>,
  itemId: string,
): boolean {
  return state.editingItemId === itemId;
}

export function discardInventoryItemDraft<Draft>(
  state: InventoryEditingState<Draft>,
  itemId: string,
): InventoryEditingState<Draft> {
  const drafts = { ...state.drafts };
  delete drafts[itemId];

  return {
    editingItemId: state.editingItemId === itemId ? null : state.editingItemId,
    drafts,
  };
}
