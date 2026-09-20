import assert from 'node:assert/strict';
import test from 'node:test';
import {
  beginInventoryItemEdit,
  isInventoryItemEditing,
  type InventoryEditingState,
} from '../src/features/inventory/inventoryEditing.ts';

test('opening one of two items keeps only that item open and drafts isolated', () => {
  const section = {
    id: 'equipment',
    items: [
      { id: 'crusher', name: 'Crusher', haveQty: 1 },
      { id: 'press', name: 'Press', haveQty: 0 },
    ],
  };
  const initial: InventoryEditingState<{ itemId: string; phaseIds: string[] }> = {
    editingItemId: null,
    drafts: {},
  };

  const first = beginInventoryItemEdit(initial, section.items[0].id, () => ({
    itemId: section.items[0].id,
    phaseIds: ['harvest'],
  }));
  const second = beginInventoryItemEdit(first, section.items[1].id, () => ({
    itemId: section.items[1].id,
    phaseIds: ['pressing'],
  }));

  assert.equal(isInventoryItemEditing(second, 'crusher'), false);
  assert.equal(isInventoryItemEditing(second, 'press'), true);
  assert.deepEqual(second.drafts.crusher, { itemId: 'crusher', phaseIds: ['harvest'] });
  assert.deepEqual(second.drafts.press, { itemId: 'press', phaseIds: ['pressing'] });
});
