import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultInventory, projectMediaPath } from '../src/lib/repositories/repository-models.ts';

test('inventory repository defaults preserve the existing document shape', () => {
  assert.deepEqual(createDefaultInventory(), {
    sections: [
      { id: 'inv1', name: 'Equipment', items: [] },
      { id: 'inv2', name: 'Supplies', items: [] },
      { id: 'inv3', name: 'Chemicals/Additives', items: [] },
    ],
  });
});

test('media repository keeps project-scoped storage paths', () => {
  assert.equal(projectMediaPath('project-1', 'photos', 'note.jpg'), 'projects/project-1/photos/note.jpg');
  assert.equal(projectMediaPath('project-1', 'library', 'guide.pdf'), 'projects/project-1/library/guide.pdf');
});
