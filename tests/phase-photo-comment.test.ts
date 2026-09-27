import assert from 'node:assert/strict';
import test from 'node:test';
import type { Node, Note } from '../src/types/index.ts';
import { resolveSelectedNode } from '../src/lib/utils.ts';

const phase = (): Node => ({
  id: 'phase-1',
  name: 'Fermentation',
  start: '',
  end: '',
  status: 'upcoming',
  notes: [],
  events: [],
  invIds: [],
  libIds: [],
  branches: null,
});

const note = (overrides: Partial<Note>): Note => ({
  id: overrides.id || 'note',
  author: 'Captain',
  text: '',
  date: '2026-01-01',
  ...overrides,
});

test('photo note stays available when a comment is saved after the upload snapshot', () => {
  const root = [phase()];
  const selectedNodeId = root[0].id;

  // The photo upload completes and the first save is reflected by a new
  // Firestore snapshot while the modal remains open.
  resolveSelectedNode(root, selectedNodeId)!.notes.push(
    note({ id: 'photo-note', photo: 'https://storage.test/photo.jpg' }),
  );
  const snapshotRoot = structuredClone(root);

  // The comment must target the freshly hydrated node, not the object selected
  // before the upload snapshot replaced the season tree.
  const currentNode = resolveSelectedNode(snapshotRoot, selectedNodeId);
  assert.ok(currentNode);
  currentNode.notes.push(note({ id: 'comment-note', text: 'Checked the aroma.' }));

  assert.equal(currentNode.notes.length, 2);
  assert.equal(currentNode.notes[0].photo, 'https://storage.test/photo.jpg');
  assert.equal(currentNode.notes[1].text, 'Checked the aroma.');
});
