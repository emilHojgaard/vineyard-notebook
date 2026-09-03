# Vineyard Notebook — Build Documentation

This document accompanies `vineyard-notebook.html`, the interactive mockup built and refined over this project. It explains what the mockup does, how its data and logic are structured, and what a real build needs to add on top of it. It's written for whoever picks this up next — a developer, or you revisiting it later.

## 1. What this is

A single-file, offline-first HTML mockup of a notebook app for a small, two-person winemaking operation. It's phone-frame styled and mobile-first. Everything — markup, styles, and logic — lives in one `.html` file with no build step and no backend; it stores its state in the browser's `localStorage`, so **it only remembers data on the device and browser it was used in**. That's the biggest thing the real build needs to fix (see §5).

Open the file directly in any browser to try it. There's no server, no npm install, nothing to run.

## 2. What it covers

Five tabs, all reachable from the bottom nav:

- **Timeline** — the season's phases (Growing Season, Harvest, Fermentation, etc.) as a scrollable vertical list, with dates, status, notes with photos, tagged inventory, and sub-events ("checks"). Where a phase splits into parallel branches (e.g. a Red and a White wine from the same harvest), branches show as tabs you switch between.
- **Tree** — the same phase/branch structure as a node-and-edge diagram, so the whole season's shape is visible at a glance. Supports adding/deleting phases and branches, renaming, and focusing on one branch to dim the rest.
- **Calendar** — a month grid built from every phase's date range plus every sub-event, opens on the current month by default, with an agenda list below.
- **Inventory** — equipment and supplies, organized into sections, with have/need quantities, prices, and links to which phases use them. Drives the "you're short on X and phase Y starts soon" alerts.
- **Library** — a reference shelf of notes, PDFs, videos, and photos (tasting notes, technique references, checklists), taggable onto phases.

A vintage/season selector (2024–2026 in the seed data) switches between a `current` season (fully editable) and `completed` ones (read-only, for looking back at past vintages). A lock toggle on the current season gates structural edits (add/delete phase or branch) without blocking everyday note-taking.

## 3. Data model

Everything lives in a few plain JS object shapes (see `SEASONS`, `INVENTORY`, `LIBRARY` near the top of the `<script>`).

### Season

```js
{
  status: "current" | "completed",
  title: "2026 Vintage",           // editable, shown atop the Tree view
  root: [ Node, Node, ... ]        // the season's own unbranched trunk, in order
}
```

### Node (a single phase)

```js
{
  id: "n7",
  name: "Primary Fermentation",
  start: "2026-09-19",             // ISO date, or "" if unset
  end: "2026-10-05",
  status: "upcoming" | "active" | "done",  // auto-derived once both dates are set (§4.2)
  notes: [ { id, author, text, date, photo? } ],
  events: [ { id, name, date } ],  // sub-events / "checks", e.g. "Density check"
  invIds: [ "i3", "i9" ],          // tags into INVENTORY
  libIds: [ "l2" ],                // tags into LIBRARY
  branches: null | [ Branch, ... ]  // null = doesn't fork here
}
```

### Branch

```js
{ id: "b2", name: "Red", nodes: [ Node, Node, ... ] }
```

A node's `branches` array holds sibling `Branch` objects, each with its own `nodes` chain — which can itself fork again arbitrarily deep. This recursive shape is what both the Timeline (branch tabs) and Tree (node/edge diagram) render from; there is no separate "graph" representation, one tree is the source of truth for both views.

**Branching rule (important, and non-obvious):** a node's `branches` array is either `null`/empty or has **2 or more** entries — it should never sit at exactly 1. The app enforces this itself:
- The *first* time you split a node, whatever phases already came after it in its own array are automatically moved into a new branch named **"Original"** (renamable), and your new branch is added alongside it — so a split always produces two branches at once, and nothing is silently discarded.
- If a branch is deleted and only one branch remains at that fork, its phases are spliced straight back into the trunk and `branches` is set back to `null` — it collapses back into a plain sequence rather than sitting there as a lonely single "branch". Splitting again from that point re-triggers the rule above.

If you extend this logic, preserve that invariant — several rendering paths (`buildTreeLayout`, the timeline's branch tabs, the calendar) assume "has branches" means "has ≥ 2".

### Inventory item

```js
{ id: "i4", name: "Glass Carboys", haveQty: 0, neededQty: 2, unit: "× 25L", price: 220 }
```
Grouped into named `sections` (e.g. "Equipment", "Supplies"). Status (`have` / `partial` / `need`) is derived from `haveQty` vs `neededQty`, not stored.

### Library item

```js
{ id: "l2", title: "Racking Without Oxidizing", type: "pdf" | "video" | "photo" | "note", content: "...", image: null | "data:..." }
```
Also grouped into sections.

### App state (not persisted per-season — this is UI state)

```js
{
  year: 2026,                // which season is showing
  tab: "timeline",            // active bottom-nav tab
  branchSelection: {},         // { [nodeId]: chosenBranchId } — remembers which tab you're on per fork
  invFilter: "all",
  calMonth: null,               // null = "current month", else "YYYY-MM"
  locked: false,                // structural-edit lock for the current season
  alertDays: 14,                 // inventory-shortage alert window
  eventAlertDays: 7,              // sub-event alert window (separate threshold, own setting)
  treeFocus: null                  // branch id currently focused in the Tree view
}
```

### Persistence

Everything (`SEASONS`, `INVENTORY`, `LIBRARY`, the id counter, and the state fields above) is serialized as one JSON blob into `localStorage` under the key `vineyard-notebook-v3`, on every change. There's no schema migration logic — if you change a data shape, old saved blobs from testing will need clearing (`localStorage.removeItem('vineyard-notebook-v3')`) or a migration step.

## 4. Core logic worth knowing about before you rebuild it

### 4.1 The Tree layout algorithm

`buildTreeLayout()` walks the season's tree recursively. Each straight run of sequential phases (no fork) is one vertical "chain"; when a chain's last node has branches, each branch becomes its own recursive sub-tree, laid out in its own column. Leaf chains get columns assigned left-to-right as they're encountered (`nextLeafCol`); a parent chain's column is the average of its children's column span, so forks visually center over what they split into. The walk is post-order (a chain's own layout record is only finalized after all its branches have been walked), which matters if you ever need "the first node" — look it up by identity (`season().root[0]`), not by `layout.nodes[0]`.

### 4.2 Status auto-sync

A phase's status stops being something you set by hand once it has both a start and end date — from that point, `derivedStatus()` computes `upcoming` / `active` / `done` by comparing today's date to the range, and `syncStatuses()` re-applies this to the whole tree on every render. Status only stays manually editable for phases missing one or both dates. This was a deliberate simplification: dates are the single source of truth for "where are we" once they exist.

### 4.3 Alerts

Two independent alert mechanisms feed the same badge UI (`phaseNeedsAttention` / `phaseAlertText`), shown on both Timeline cards and Tree nodes:
- **Inventory shortages** — a phase whose start is within `state.alertDays` (default 14) and which references an inventory item still short (`haveQty < neededQty`).
- **Sub-event / "check" alerts** — any of a phase's own `events` due within `state.eventAlertDays` (default 7, independent from the inventory window). These also surface as their own entries in the Calendar's agenda list, tagged "check".

Sub-events take priority in the badge text when both apply. Both windows are user-editable in the settings sheet (gear icon).

### 4.4 Branch color

Colors aren't stored on nodes — they're computed while walking the tree, so a branch and everything under it always renders consistently without needing to store/sync a color value. Top-level branches (off the trunk, `TRUNK_COLOR`) get the next color from a fixed palette (`PALETTE`); a nested branch (off another branch) instead gets a `color-mix()` shade of its *parent's* color (`shadeColor` / `branchColor`), so a sub-split reads visually as "part of" its parent branch rather than an unrelated new color.

### 4.5 Lock vs. archived (two separate read-only states)

- `isArchived()` — true for any season whose `status !== "current"`. Full stop, nothing is editable.
- `isLocked()` (aliased `isReadOnly()`) — true if archived, *or* if the user has toggled the padlock on. This gates only structural/destructive actions: adding/deleting a phase or branch, deleting an inventory/library item, renaming in the Tree view. Notes, dates, statuses, and item fields (name/qty/price) stay editable while merely locked — the lock is meant to prevent accidental restructuring, not block routine logging.

### 4.6 Everything reads from one tree — Timeline, Tree, and Calendar all derive their view from `season().root`; there's no separate calendar-events list or timeline-order list to keep in sync. If you rebuild this with a real data layer, keeping that "one tree, multiple views" property will save you from a whole class of sync bugs.

## 5. What's stubbed for the mockup — needs real implementation

This is the important part for scoping the real build.

- **No backend, no sync.** Everything is `localStorage` on one browser, one device. For a 2-person operation, this needs a real data layer both people read/write to (even something simple like a shared cloud document store or a small hosted API + database) with basic conflict handling — last-write-wins is probably fine at this scale, but simultaneous edits will currently just silently clobber each other if you naively port the `localStorage` approach to a shared backend.
- **No auth.** There's no concept of "who's logged in" — notes have an author field (`AUTHORS = ["Captain", "Helper"]`, hardcoded) but nothing enforces or verifies it.
- **No external calendar sync.** The Calendar tab has an "Export to calendar" button that's a placeholder toast — real `.ics` export (or live Google/Apple Calendar sync) needs a backend capable of generating/serving calendar feeds, which a static HTML file can't do.
- **No push notifications.** Alerts (§4.3) only show as in-app badges when the app happens to be open. A real build that wants "tell me 3 days before I run out of yeast" without opening the app needs actual notifications (email, SMS, or push), which means a server-side scheduler, not just client-side date math.
- **Photos are inlined as base64 in localStorage.** Fine for a couple of note photos in a demo; will blow through `localStorage`'s ~5–10MB limit fast in real use. Needs real file storage (even just a cloud storage bucket) with the app storing a URL instead of the image data.
- **No data export/backup.** If `localStorage` is cleared (or the browser/device changes), everything is gone. A real build needs actual durable storage regardless of the sync question above.
- **No schema versioning/migration.** As noted in §3, changing a data shape has no upgrade path for existing saved data; worth designing in from the start for a real build.
- **Single hardcoded seed dataset.** The 2024–2026 seasons are hand-written sample data in the script for demo purposes, not a real onboarding flow for a new vineyard/user.

## 6. What's *not* stubbed — carries over directly

The parts worth reusing as-is (as logic/spec, even if reimplemented in a different stack):
- The data model in §3, including the branching invariant in the Node/Branch note.
- The status auto-sync rule (§4.2).
- The two-tier alert system and its two independent thresholds (§4.3).
- The lock-vs-archived distinction (§4.5) — it's a genuinely useful UX pattern, not a mockup shortcut.
- The overall tab structure and the "one tree drives every view" principle (§4.6).
- The branching UX itself (split, focus, collapse-on-delete-to-one) — this went through several rounds of refinement based on real usage feedback and reflects actual workflow needs, not an arbitrary first pass.

## 7. Files in this export

- `vineyard-notebook.html` — the interactive mockup itself. Open directly in a browser.
- `BUILD-NOTES.md` — this document.
