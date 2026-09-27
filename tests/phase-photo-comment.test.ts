import assert from 'node:assert/strict';
import test from 'node:test';
import type { Node, Note } from '../src/types/index.ts';
import { resolveSelectedNode, updateNodeById } from '../src/lib/utils.ts';

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
  const otherPhase = phase();
  otherPhase.id = 'phase-2';
  otherPhase.name = 'Bottling';
  const root = [phase(), otherPhase];
  const selectedNodeId = root[0].id;

  // The photo upload completes and the first save is reflected by a new
  // Firestore snapshot while the modal remains open.
  assert.equal(updateNodeById(root, selectedNodeId, (node) => {
    node.notes.push(note({ id: 'photo-note', photo: 'https://storage.test/photo.jpg' }));
  }), true);
  const snapshotRoot = structuredClone(root);

  // Changing the selected phase while the modal rerenders must not retarget
  // the in-flight operation. The comment still belongs to its original phase.
  const newlySelectedNodeId = 'phase-2';
  assert.notEqual(newlySelectedNodeId, selectedNodeId);
  assert.equal(updateNodeById(snapshotRoot, selectedNodeId, (node) => {
    node.notes.push(note({ id: 'comment-note', text: 'Checked the aroma.' }));
  }), true);
  const currentNode = resolveSelectedNode(snapshotRoot, selectedNodeId);
  assert.ok(currentNode);

  assert.equal(currentNode.notes.length, 2);
  assert.equal(currentNode.notes[0].photo, 'https://storage.test/photo.jpg');
  assert.equal(currentNode.notes[1].text, 'Checked the aroma.');
  assert.equal(resolveSelectedNode(snapshotRoot, newlySelectedNodeId)?.notes.length, 0);
});

test('failed photo upload keeps the comment draft for a successful retry', async () => {
  const root = [phase()];
  const selectedNodeId = root[0].id;
  const draft = {
    photo: 'data:image/jpeg;base64,photo',
    text: 'Checked the aroma after pressing.',
  };
  const photoUrl = await Promise.resolve('https://storage.test/retry.jpg');

  const failedUpload = async () => {
    throw new Error('network unavailable');
  };
  await assert.rejects(failedUpload);
  // A failed upload must not consume either draft value.
  assert.equal(draft.photo, 'data:image/jpeg;base64,photo');
  assert.equal(draft.text, 'Checked the aroma after pressing.');

  const retriedRoot = structuredClone(root);
  assert.equal(updateNodeById(retriedRoot, selectedNodeId, (node) => {
    node.notes.push(note({ id: 'retry-note', text: draft.text, photo: photoUrl }));
  }), true);

  const savedNode = resolveSelectedNode(retriedRoot, selectedNodeId);
  assert.ok(savedNode);
  assert.equal(savedNode.notes[0].text, draft.text);
  assert.equal(savedNode.notes[0].photo, 'https://storage.test/retry.jpg');
});
