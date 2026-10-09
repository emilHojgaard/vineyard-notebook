import assert from 'node:assert/strict';
import test from 'node:test';
import { joinSeasonRoot, splitSeasonRoot } from '../src/lib/repositories/season-storage.ts';
import type { Node } from '../src/types/index.ts';

const seasonRoot: Node[] = [{
  id: 'harvest',
  name: 'Harvest',
  start: '2026-09-01',
  end: '2026-09-10',
  status: 'upcoming',
  notes: [],
  events: [],
  invIds: [],
  libIds: [],
  branches: [
    {
      id: 'red',
      name: 'Red',
      nodes: [{
        id: 'red-ferment',
        name: 'Fermentation',
        start: '',
        end: '',
        status: 'upcoming',
        notes: [],
        events: [],
        invIds: ['yeast'],
        libIds: [],
        branches: null,
      }],
    },
    { id: 'white', name: 'White', nodes: [] },
  ],
}];

test('season storage keeps structural identity separate from content edits', () => {
  const original = splitSeasonRoot(seasonRoot);
  const editedRoot = structuredClone(seasonRoot);
  editedRoot[0].notes.push({
    id: 'note-1',
    author: 'captain-production',
    text: 'Checked fruit',
    date: '2026-08-30',
  });

  const edited = splitSeasonRoot(editedRoot);
  assert.deepEqual(edited.structure, original.structure);
  assert.notDeepEqual(edited.content, original.content);
  assert.deepEqual(joinSeasonRoot(edited.structure, edited.content), editedRoot);
});

test('season storage treats a phase rename as structural', () => {
  const original = splitSeasonRoot(seasonRoot);
  const renamedRoot = structuredClone(seasonRoot);
  renamedRoot[0].name = 'Harvest (updated)';

  assert.notDeepEqual(splitSeasonRoot(renamedRoot).structure, original.structure);
});
