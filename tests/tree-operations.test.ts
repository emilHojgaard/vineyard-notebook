import assert from 'node:assert/strict';
import test from 'node:test';
import type { Node } from '../src/types/index.ts';
import {
  addBranchToTree,
  deleteBranchFromTree,
  deleteNodeFromTree,
} from '../src/lib/tree-operations.ts';
import { getHighlightedNodeIds, validateTree } from '../src/lib/tree.ts';

const node = (id: string, branches: Node['branches'] = null): Node => ({
  id,
  name: id,
  start: '',
  end: '',
  status: 'upcoming',
  notes: [],
  events: [],
  invIds: [],
  libIds: [],
  branches,
});

test('deleting a nested phase preserves and promotes its branches', () => {
  const root = [
    node('parent', [
      { id: 'red', name: 'Red', nodes: [node('target', [
        { id: 'still-red', name: 'Still Red', nodes: [node('red-child')] },
        { id: 'still-white', name: 'Still White', nodes: [node('white-child')] },
      ])] },
      { id: 'white', name: 'White', nodes: [] },
    ]),
  ];

  deleteNodeFromTree(root, 'target');
  const parent = root[0];
  assert.equal(parent.branches?.length, 4);
  assert.deepEqual(parent.branches?.map(branch => branch.name), ['Red', 'White', 'Still Red', 'Still White']);
  assert.equal(validateTree(root).valid, true);
});

test('deleting a non-first root phase preserves its branches on the previous root phase', () => {
  const root = [node('first'), node('target', [
    { id: 'red', name: 'Red', nodes: [node('red-child')] },
    { id: 'white', name: 'White', nodes: [node('white-child')] },
  ])];

  deleteNodeFromTree(root, 'target');
  assert.equal(root.length, 1);
  assert.deepEqual(root[0].branches?.map(branch => branch.name), ['Red', 'White']);
  assert.equal(validateTree(root).valid, true);
});

test('refuses to delete the first root phase when it owns branches', () => {
  const root = [node('target', [
    { id: 'red', name: 'Red', nodes: [node('red-child')] },
    { id: 'white', name: 'White', nodes: [node('white-child')] },
  ])];

  assert.throws(() => deleteNodeFromTree(root, 'target'), /Cannot delete the first root phase/);
  assert.equal(root[0].id, 'target');
  assert.equal(validateTree(root).valid, true);
});

test('adding a branch preserves following trunk phases in Original', () => {
  const root = [node('parent'), node('following')];
  addBranchToTree(root, 'parent', { id: 'red', name: 'Red', nodes: [node('red-child')] });

  assert.deepEqual(root.map(item => item.id), ['parent']);
  assert.deepEqual(root[0].branches?.map(branch => branch.name), ['Original', 'Red']);
  assert.deepEqual(root[0].branches?.[0].nodes.map(item => item.id), ['following']);
  assert.equal(validateTree(root).valid, true);
});

test('deleting one of two branches collapses the branch point', () => {
  const root = [node('parent', [
    { id: 'red', name: 'Red', nodes: [node('red-child')] },
    { id: 'white', name: 'White', nodes: [node('white-child')] },
  ]), node('after')];

  deleteBranchFromTree(root, 'parent', 'red');
  assert.deepEqual(root.map(item => item.id), ['parent', 'white-child', 'after']);
  assert.equal(root[0].branches, null);
  assert.equal(validateTree(root).valid, true);
});

test('deleting an unknown node leaves the tree unchanged', () => {
  const root = [node('first')];
  deleteNodeFromTree(root, 'missing');
  assert.deepEqual(root.map(item => item.id), ['first']);
});

test('focused branch highlights the same ancestors and descendants for every view', () => {
  const root = [
    node('before'),
    node('fork', [
      { id: 'red', name: 'Red', nodes: [node('red-phase')] },
      { id: 'white', name: 'White', nodes: [node('white-phase')] },
    ]),
    node('after'),
  ];

  assert.deepEqual(
    [...getHighlightedNodeIds(root, 'white')],
    ['before', 'fork', 'white-phase'],
  );
  assert.deepEqual([...getHighlightedNodeIds(root, null)], []);
});
