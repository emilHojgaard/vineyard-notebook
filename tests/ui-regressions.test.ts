import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('header overlays stay above the transformed season selector', () => {
  const header = read('src/components/Header.tsx');
  assert.match(header, /className="relative z-30 bg-burgundy/);
});

test('mobile web app metadata keeps both standard and Apple declarations', () => {
  const html = read('index.html');
  assert.match(html, /<meta name="mobile-web-app-capable" content="yes" \/>/);
  assert.match(html, /<meta name="apple-mobile-web-app-capable" content="yes" \/>/);
});

test('TreeView gives empty branches a browse message and an edit action', () => {
  const tree = read('src/features/tree/TreeView.tsx');

  assert.match(tree, /role="status"/);
  assert.match(tree, /aria-label=\{`\$\{label\.name\}: Empty branch`\}/);
  assert.match(tree, /<span className="py-2 text-center text-xs text-ink-faint">Empty branch<\/span>/);
  assert.match(tree, /aria-label=\{`Add phase to \$\{label\.name\}`\}/);
  assert.match(tree, /setAddingPhase\(\{ parentNodeId: label\.parentNodeId, branchId: label\.branchId \}\)/);
});

test('phase and item creation fields opt into initial focus', () => {
  const phaseModal = read('src/features/timeline/PhaseModal.tsx');
  const timeline = read('src/features/timeline/TimelineView.tsx');
  const tree = read('src/features/tree/TreeView.tsx');
  const inventory = read('src/features/inventory/InventoryView.tsx');
  const library = read('src/features/library/LibraryView.tsx');

  assert.match(phaseModal, /<input[\s\S]*?data-autofocus[\s\S]*?className/);
  assert.match(timeline, /placeholder="Phase name"\s+autoFocus\s+data-autofocus/);
  assert.match(timeline, /id="new-phase-name"[\s\S]*?data-autofocus/);
  assert.match(tree, /id="tree-phase-name"[\s\S]*?data-autofocus/);
  assert.match(inventory, /<input[\s\S]*?autoFocus\s+data-autofocus[\s\S]*?className/);
  assert.match(library, /value=\{currentEditingItem\.title\}[\s\S]*?autoFocus\s+data-autofocus/);
});
