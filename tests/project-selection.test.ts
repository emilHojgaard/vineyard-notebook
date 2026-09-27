import assert from 'node:assert/strict';
import test from 'node:test';
import type { Project } from '../src/types/index.ts';
import { reconcileProjectSelection } from '../src/lib/project-selection.ts';

const project = (id: string, name = id): Project => ({
  id,
  name,
  members: ['captain'],
  createdBy: 'captain',
  createdAt: new Date(2025, 0, 1),
});

test('a newly created project remains selected through cached empty and old-project snapshots', () => {
  const oldProject = project('old', 'Old Vineyard');
  const newProject = project('new', 'New Vineyard');

  const initial = reconcileProjectSelection([oldProject], oldProject, newProject);
  assert.equal(initial.project?.id, 'new');
  assert.equal(initial.pendingProject?.id, 'new');

  const cachedEmpty = reconcileProjectSelection([], initial.project, initial.pendingProject);
  assert.equal(cachedEmpty.project?.id, 'new');
  assert.equal(cachedEmpty.pendingProject?.id, 'new');

  const cachedOldList = reconcileProjectSelection([oldProject], cachedEmpty.project, cachedEmpty.pendingProject);
  assert.equal(cachedOldList.project?.id, 'new');
  assert.equal(cachedOldList.pendingProject?.id, 'new');

  const confirmed = reconcileProjectSelection([oldProject, newProject], cachedOldList.project, cachedOldList.pendingProject);
  assert.equal(confirmed.project?.id, 'new');
  assert.equal(confirmed.pendingProject, null);
});

test('first project is selected after reload once the server list is confirmed', () => {
  const newProject = project('new', 'New Vineyard');

  const cachedEmpty = reconcileProjectSelection([], null, null);
  assert.equal(cachedEmpty.project, null);

  const serverList = reconcileProjectSelection([newProject], cachedEmpty.project, cachedEmpty.pendingProject);
  assert.equal(serverList.project?.id, 'new');
  assert.equal(serverList.pendingProject, null);
});

test('a confirmed project keeps its local object across equivalent cached snapshots', () => {
  const selected = project('selected', 'Selected Vineyard');
  const cachedEquivalent = { ...selected, createdAt: new Date(2026, 0, 1) };

  const result = reconcileProjectSelection([cachedEquivalent], selected, null);
  assert.equal(result.project, selected);
});
