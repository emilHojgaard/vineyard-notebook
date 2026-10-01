import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('authentication and project setup keep native form keyboard submission', () => {
  const login = read('src/features/auth/LoginPage.tsx');
  const setup = read('src/features/auth/ProjectSetup.tsx');

  assert.match(login, /<form onSubmit=\{handleSubmit\}/);
  assert.match(setup, /<form onSubmit=\{handleCreate\}/);
  assert.match(login, /onChange=\{\(e\) => setEmail\(e\.target\.value\)\}/);
  assert.match(setup, /onChange=\{\(e\) => setProjectName\(e\.target\.value\)\}/);
});

test('project and season menus support arrow navigation and Escape focus restoration', () => {
  const header = read('src/components/Header.tsx');
  const season = read('src/components/SeasonSelector.tsx');

  assert.match(header, /handleProjectMenuKeyDown/);
  assert.match(header, /event\.key === 'ArrowDown'/);
  assert.match(header, /event\.key === 'Home' \|\| event\.key === 'End'/);
  assert.match(header, /projectTriggerRef\.current\?\.focus\(\)/);
  assert.match(season, /handleSeasonMenuKeyDown/);
  assert.match(season, /role="menuitem"/);
  assert.match(season, /seasonTriggerRef\.current\?\.focus\(\)/);
});

test('modal keyboard handling traps Tab, closes on Escape, and preserves editable fields', () => {
  const keyboard = read('src/components/useModalKeyboard.ts');
  const modal = read('src/components/Modal.tsx');
  const confirm = read('src/components/ConfirmDialog.tsx');

  assert.match(keyboard, /event\.key === 'Escape'/);
  assert.match(keyboard, /event\.key !== 'Tab'/);
  assert.match(keyboard, /event\.preventDefault\(\)/);
  assert.match(keyboard, /\[contenteditable="true"\]/);
  assert.match(modal, /onKeyDown=\{keyboard\.onKeyDown\}/);
  assert.match(confirm, /onKeyDown=\{keyboard\.onKeyDown\}/);
});

test('Timeline and Tree creation fields activate with Enter without losing Escape cancellation', () => {
  const timeline = read('src/features/timeline/TimelineView.tsx');
  const tree = read('src/features/tree/TreeView.tsx');

  assert.match(timeline, /e\.key === 'Enter'[\s\S]*?e\.preventDefault\(\)[\s\S]*?handleAddPhase\(\)/);
  assert.match(timeline, /e\.key === 'Escape'[\s\S]*?setAddingPhase\(false\)/);
  assert.match(tree, /e\.key === 'Enter'[\s\S]*?e\.preventDefault\(\)[\s\S]*?handleAddPhase\(\)/);
  assert.match(tree, /e\.key === 'Enter'[\s\S]*?e\.preventDefault\(\)[\s\S]*?handleSplitPhase\(branchingNode\)/);
});

test('Tree zoom shortcuts are scoped and leave text entry untouched', () => {
  const tree = read('src/features/tree/TreeView.tsx');

  assert.match(tree, /window\.addEventListener\('keydown', handleKeyDown\)/);
  assert.match(tree, /isTextInput\(event\.target\)/);
  assert.match(tree, /event\.key === '\+' \|\| event\.key === '='/);
  assert.match(tree, /event\.key === '-' \|\| event\.key === '_'/);
});

test('Calendar, Inventory, Library, and invitation controls have keyboard paths', () => {
  const calendar = read('src/features/calendar/DayEventsModal.tsx');
  const inventory = read('src/features/inventory/InventoryView.tsx');
  const library = read('src/features/library/LibraryView.tsx');
  const invitations = read('src/components/InvitationPrompt.tsx');

  assert.match(calendar, /onKeyDown=\{\(e\) => \{[\s\S]*?handleAddEvent\(\)/);
  assert.match(inventory, /aria-label=\{`Edit inventory item \$\{item\.name\}`\}/);
  assert.match(inventory, /event\.key === 'Escape'[\s\S]*?handleCancelEdit\(itemKey\)/);
  assert.match(library, /e\.key === 'Escape'[\s\S]*?setAddingSection\(false\)/);
  assert.match(invitations, /event\.key === 'Escape'[\s\S]*?triggerRef\.current\?\.focus\(\)/);
});
