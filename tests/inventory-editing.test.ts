import assert from 'node:assert/strict';
import test from 'node:test';
import {
  beginInventoryItemEdit,
  discardInventoryItemDraft,
  inventoryItemKey,
  isInventoryItemEditing,
  updateInventoryItemPhaseLinks,
  type InventoryEditingState,
} from '../src/features/inventory/inventoryEditing.ts';

const identity = (sectionId: string, itemId: string, itemIndex: number) =>
  inventoryItemKey({ sectionId, itemId, itemIndex });

test('opening one of three items keeps the other rows closed', () => {
  const items = [
    identity('equipment', 'crusher', 0),
    identity('equipment', 'press', 1),
    identity('equipment', 'meter', 2),
  ];
  let state: InventoryEditingState<{ itemId: string }> = {
    editingItemKey: null,
    drafts: {},
  };

  state = beginInventoryItemEdit(state, items[0], () => ({ itemId: 'crusher' }));
  assert.equal(isInventoryItemEditing(state, items[0]), true);
  assert.equal(isInventoryItemEditing(state, items[1]), false);
  assert.equal(isInventoryItemEditing(state, items[2]), false);

  state = beginInventoryItemEdit(state, items[1], () => ({ itemId: 'press' }));
  assert.equal(isInventoryItemEditing(state, items[0]), false);
  assert.equal(isInventoryItemEditing(state, items[1]), true);
  assert.equal(isInventoryItemEditing(state, items[2]), false);

  state = beginInventoryItemEdit(state, items[2], () => ({ itemId: 'meter' }));
  assert.equal(isInventoryItemEditing(state, items[0]), false);
  assert.equal(isInventoryItemEditing(state, items[1]), false);
  assert.equal(isInventoryItemEditing(state, items[2]), true);
  assert.deepEqual(state.drafts[items[0]], { itemId: 'crusher' });
  assert.deepEqual(state.drafts[items[1]], { itemId: 'press' });
});

test('duplicate persisted item IDs still produce independent row identities', () => {
  const first = identity('equipment', 'inv1', 0);
  const second = identity('equipment', 'inv1', 1);
  assert.notEqual(first, second);

  let state: InventoryEditingState<{ value: string }> = {
    editingItemKey: null,
    drafts: {},
  };
  state = beginInventoryItemEdit(state, first, () => ({ value: 'first' }));
  state = beginInventoryItemEdit(state, second, () => ({ value: 'second' }));

  assert.equal(isInventoryItemEditing(state, first), false);
  assert.equal(isInventoryItemEditing(state, second), true);
  assert.deepEqual(state.drafts[first], { value: 'first' });
  assert.deepEqual(state.drafts[second], { value: 'second' });
});

test('phase links update only the item being saved', () => {
  const nodes = [
    {
      id: 'harvest', name: 'Harvest', start: '', end: '', status: 'upcoming', notes: [], events: [],
      invIds: ['crusher'], libIds: [], branches: null,
    },
    {
      id: 'pressing', name: 'Pressing', start: '', end: '', status: 'upcoming', notes: [], events: [],
      invIds: ['press'], libIds: [], branches: null,
    },
  ];

  updateInventoryItemPhaseLinks(nodes, 'crusher', ['pressing']);

  assert.deepEqual(nodes[0].invIds, []);
  assert.deepEqual(nodes[1].invIds, ['press', 'crusher']);
});

test('canceling the selected item discards only its draft', () => {
  const first = identity('equipment', 'crusher', 0);
  const second = identity('equipment', 'press', 1);
  let state: InventoryEditingState<{ value: string }> = {
    editingItemKey: null,
    drafts: {},
  };
  state = beginInventoryItemEdit(state, first, () => ({ value: 'changed crusher' }));
  state = beginInventoryItemEdit(state, second, () => ({ value: 'changed press' }));
  state = discardInventoryItemDraft(state, second);

  assert.equal(state.editingItemKey, null);
  assert.deepEqual(state.drafts[first], { value: 'changed crusher' });
  assert.equal(state.drafts[second], undefined);
});
