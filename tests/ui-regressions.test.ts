import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('pending invitations are an optional inbox, not a blocking modal', () => {
  const prompt = read('src/components/InvitationPrompt.tsx');

  assert.doesNotMatch(prompt, /aria-modal/);
  assert.doesNotMatch(prompt, /useModalKeyboard/);
  assert.doesNotMatch(prompt, /document\.body\.style\.overflow/);
  assert.match(prompt, /setIsExpanded\(false\)/);
  assert.match(prompt, /aria-label=\{`Pending invitations: \$\{pendingInvitations\.length\}`\}/);
  assert.match(prompt, /absolute right-0 top-full/);
  assert.doesNotMatch(prompt, /fixed top-4 right-4/);
  assert.match(prompt, /notifyError\('Failed to (accept|decline) invitation/);
  assert.match(prompt, /pendingInvitations\.map/);
});

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
  assert.match(header, /className="relative z-30 safe-area-top bg-burgundy/);
});

test('pending invitations are represented by an accessible header badge and popover', () => {
  const header = read('src/components/Header.tsx');
  const prompt = read('src/components/InvitationPrompt.tsx');

  assert.match(header, /import \{ InvitationPrompt \} from '\.\/InvitationPrompt';/);
  assert.match(header, /<InvitationPrompt \/>/);
  assert.match(prompt, /aria-haspopup="dialog"/);
  assert.match(prompt, /aria-expanded=\{isExpanded\}/);
  assert.match(prompt, /bg-white px-1 text-\[10px\]/);
  assert.match(prompt, /role="dialog"/);
  assert.doesNotMatch(prompt, /aria-modal/);
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
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1\.0" \/>/);
  assert.match(html, /<meta name="mobile-web-app-capable" content="yes" \/>/);
  assert.match(html, /<meta name="apple-mobile-web-app-capable" content="yes" \/>/);
});

test('application shell fills the viewport without desktop gutters and preserves safe areas', () => {
  const shell = read('src/components/AppShell.tsx');
  const styles = read('src/index.css');

  assert.match(shell, /w-full min-h-\[100dvh\]/);
  assert.match(shell, /h-\[100dvh\]/);
  assert.match(shell, /safe-area-bottom/);
  assert.doesNotMatch(shell, /sm:p-4|lg:p-6|xl:p-8/);
  assert.doesNotMatch(shell, /max-w-\[1440px\]/);
  assert.doesNotMatch(shell, /hidden sm:flex/);
  assert.match(styles, /background: var\(--parchment\)/);
  assert.match(styles, /@media \(max-width: 639px\)/);
  assert.match(styles, /\.safe-area-top/);
  assert.match(styles, /\.safe-area-bottom/);
});

test('desktop content columns expand for collection views', () => {
  const inventory = read('src/features/inventory/InventoryView.tsx');
  const library = read('src/features/library/LibraryView.tsx');
  const calendar = read('src/features/calendar/CalendarView.tsx');

  assert.match(inventory, /lg:grid-cols-2/);
  assert.match(library, /lg:grid-cols-2/);
  assert.match(calendar, /max-w-\[1600px\] mx-auto/);
});

test('calendar density is responsive without shrinking mobile controls', () => {
  const calendar = read('src/features/calendar/CalendarView.tsx');
  const dayModal = read('src/features/calendar/DayEventsModal.tsx');
  const subscriptionModal = read('src/features/calendar/CalendarSubscriptionModal.tsx');

  // Mobile retains square, centered, touch-friendly day buttons. Desktop uses
  // six equal rows and a viewport-aware height instead of width-driven squares.
  assert.match(calendar, /aspect-square lg:aspect-auto/);
  assert.match(calendar, /lg:grid-rows-6/);
  assert.match(calendar, /lg:h-\[clamp\(22rem,calc\(100dvh-17rem\),40rem\)\]/);
  assert.match(calendar, /lg:text-base/);
  assert.match(calendar, /lg:gap-2/);
  // Date labels stay readable while the event dots use the cell's bottom
  // padding instead of floating under the label. Desktop gets extra inset
  // without changing mobile's touch-sized cells.
  assert.match(calendar, /p-2 lg:p-3 lg:pb-5 rounded-md flex flex-col items-center justify-between/);
  assert.match(calendar, /dayData\.events\.length > 0[\s\S]*?flex gap-0\.5 mt-1 lg:mt-2/);
  assert.match(dayModal, /maxWidth="720px"/);
  assert.match(dayModal, /sm:text-base font-semibold/);
  assert.match(subscriptionModal, /max-w-3xl/);
  assert.match(subscriptionModal, /lg:max-h-\[calc\(100dvh-3rem\)\]/);
});

test('TreeView centers its scrollable canvas and keeps empty branch anchors in layout bounds', () => {
  const tree = read('src/features/tree/TreeView.tsx');

  assert.match(tree, /w-full min-w-0 max-w-full overflow-auto/);
  assert.match(tree, /getCenteredScrollLeft\(scrollWidth, containerWidth\)/);
  assert.match(tree, /const branchStartEdge = layout\.edges\.find/);
  assert.match(tree, /const CANVAS_PADDING = COL_GAP \/ 2/);
  assert.match(tree, /const contentWidth = CANVAS_PADDING \* 2 \+ maxCol/);
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
