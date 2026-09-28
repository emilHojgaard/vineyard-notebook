import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('alert settings keep transient text separate from saved values', () => {
  const shell = read('src/components/AppShell.tsx');

  assert.match(shell, /value=\{alertDaysDraft\}/);
  assert.match(shell, /onChange=\{\(e\) => setAlertDaysDraft\(e\.target\.value\)\}/);
  assert.match(shell, /onBlur=\{\(\) => commitAlertDays\(alertDaysDraft, appState\.alertDays/);
  assert.match(shell, /min=\{ALERT_DAYS_MIN\}/);
  assert.match(shell, /max=\{ALERT_DAYS_MAX\}/);
  assert.doesNotMatch(shell, /parseInt\(e\.target\.value\) \|\| 14/);
});

test('timeline and tree use the shared alert settings and presentation', () => {
  const timeline = read('src/features/timeline/TimelineView.tsx');
  const tree = read('src/features/tree/TreeView.tsx');

  assert.match(timeline, /import \{ getPhaseAlert \} from '\.\.\/\.\.\/lib\/alerts';/);
  assert.match(tree, /import \{ getPhaseAlert \} from '\.\.\/\.\.\/lib\/alerts';/);
  assert.match(timeline, /getPhaseAlert\(node, inv, appState\.alertDays, appState\.eventAlertDays\)/);
  assert.match(tree, /getPhaseAlert\(layoutNode\.node, inv, appState\.alertDays, appState\.eventAlertDays\)/);
  assert.match(tree, /aria-label=\{`Alert: \$\{alert\.text\}`\}/);
});

test('header overlays stay above the transformed season selector', () => {
  const header = read('src/components/Header.tsx');
  assert.match(header, /className="relative z-30 bg-burgundy/);
});

test('project and season lists dismiss on outside pointers without closing internal controls', () => {
  const header = read('src/components/Header.tsx');
  const seasonSelector = read('src/components/SeasonSelector.tsx');

  assert.match(header, /const projectMenuRef = useRef<HTMLDivElement>\(null\);/);
  assert.match(header, /document\.addEventListener\('pointerdown', closeProjectMenuOnOutsidePointer\)/);
  assert.match(header, /projectMenuRef\.current\.contains\(target\)/);
  assert.match(header, /document\.removeEventListener\('pointerdown', closeProjectMenuOnOutsidePointer\)/);
  assert.match(seasonSelector, /const selectorRef = useRef<HTMLDivElement>\(null\);/);
  assert.match(seasonSelector, /document\.addEventListener\('pointerdown', closeOnOutsidePointer\)/);
  assert.match(seasonSelector, /selectorRef\.current\.contains\(target\)/);
  assert.match(seasonSelector, /document\.removeEventListener\('pointerdown', closeOnOutsidePointer\)/);
  assert.match(seasonSelector, /document\.addEventListener\('keydown', closeOnEscape\)/);
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

test('inventory item additions stay available outside edit mode', () => {
  const inventory = read('src/features/inventory/InventoryView.tsx');

  assert.match(inventory, /const handleAddItem = async \(sectionId: string\) => \{\s+if \(isArchived\) return;/);
  assert.match(inventory, /\{!isArchived && \(\s+<button\s+onClick=\{\(\) => handleAddItem\(section\.id\)\}/);
  assert.match(inventory, /const handleDeleteSection = async \(sectionId: string\) => \{\s+if \(isArchived \|\| !isEditMode\) return;/);
  assert.match(inventory, /const handleDeleteItem = async \(sectionId: string, itemId: string, itemIndex: number\) => \{\s+if \(isArchived \|\| !isEditMode\) return;/);
});

test('note photos use compact thumbnails and an accessible in-app lightbox', () => {
  const phaseModal = read('src/features/timeline/PhaseModal.tsx');
  const lightbox = read('src/features/timeline/NotePhotoLightbox.tsx');

  assert.doesNotMatch(phaseModal, /window\.open\(note\.photo/);
  assert.match(phaseModal, /aria-haspopup="dialog"/);
  assert.match(phaseModal, /Note attachment thumbnail/);
  assert.match(phaseModal, /object-contain/);
  assert.match(phaseModal, /<NotePhotoLightbox photo=\{isOpen \? lightboxPhoto : null\}/);
  assert.match(lightbox, /createPortal\(/);
  assert.match(lightbox, /role="dialog"/);
  assert.match(lightbox, /aria-modal="true"/);
  assert.match(lightbox, /event\.target === overlayRef\.current/);
  assert.match(lightbox, /useModalKeyboard\(isOpen, onClose, dialogRef\)/);
  assert.match(lightbox, /aria-label="Close image"/);
  assert.match(lightbox, /document\.body\.style\.overflow = 'hidden'/);
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
