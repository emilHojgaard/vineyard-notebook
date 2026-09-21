# Vineyard Notebook UX/UI audit

**Scope:** static review of the implemented React flows and a production build (`npm run build`, passed). No fixes were made. Findings below are confirmed from the current implementation unless explicitly marked as a suggestion. “Overlap” refers to the existing minor-bug/UX item in `BUG_5_UX_REFINEMENTS.md`; no other minor-bug register was present in the worktree.

## Priority summary

| Priority | Finding |
|---|---|
| P1 | Calendar event days are not interactive; the implemented day-details/add-check flow is unreachable. |
| P1 | Modal accessibility is incomplete (dialog semantics, focus management, labels). |
| P1 | Tree nodes contain nested buttons, creating invalid/ambiguous keyboard interaction. |
| P1 | Archived seasons are read-only in timeline/tree but inventory remains editable. |
| P2 | The app is presented as a fixed phone frame on desktop and can feel cramped on mobile/short viewports. |
| P2 | Several icon-only controls and hover-only destructive controls are difficult to discover/use by touch or keyboard. |
| P2 | Timeline status visibility depends on lock mode and alerts can describe overdue events as “coming up.” |
| P2 | Season selector can disappear completely while scrolling, removing the year context/control. |
| P3 | Loading and mutation errors are inconsistent and mostly non-recoverable browser alerts/plain text. |

## Confirmed issues

### 1. Calendar events cannot be inspected or added from the calendar
- **Reproduction:** Sign in → select a season with a dated phase/check → Calendar → click a day containing event dots (or an empty day). Nothing happens; there is no agenda/list in the rendered view.
- **Affected:** `src/features/calendar/CalendarView.tsx`; intended `DayEventsModal` flow in `src/features/calendar/DayEventsModal.tsx`.
- **Problem/impact:** The calendar communicates that events exist only through tiny dots, but users cannot see which event, open its phase, delete a check, or use the existing “Add a check” UI. This makes the calendar a read-only visual rather than a usable planning surface and is especially problematic for touch users.
- **Severity/confidence:** P1 / high.
- **Recommendation:** Make each populated and empty day an actual button with an accessible date label; open `DayEventsModal` on activation and offer a visible agenda fallback below the grid.
- **Evidence:** `DayEventsModal` is defined but never imported/rendered (`rg` found no usage); calendar day cells are `<div>` elements without `onClick`.
- **Overlap:** No (not covered by `BUG_5_UX_REFINEMENTS.md`).

### 2. Dialogs do not provide reliable keyboard/screen-reader behavior
- **Reproduction:** Open a phase, library item, settings, members, create-season, or confirmation dialog → press Tab repeatedly. Focus can leave the overlay; on close, focus is not restored. Screen readers do not receive dialog semantics or a labelled dialog.
- **Affected:** `src/components/Modal.tsx`, `src/components/ConfirmDialog.tsx`, plus ad-hoc overlays in `AppShell`, `Header`, and `SeasonSelector`.
- **Problem/impact:** Keyboard users can interact with background controls behind a modal, lose their place after close, and may not know a dialog opened. Close buttons are icon-only without accessible names. This is a blocking accessibility issue for editing and destructive flows.
- **Severity/confidence:** P1 / high.
- **Recommendation:** Use `role="dialog"`, `aria-modal="true"`, and `aria-labelledby`; provide `aria-label`s for icon-only close/actions; trap focus while open, focus the first meaningful control, restore focus on close, and standardize all overlays on the shared modal primitive.
- **Evidence:** `Modal` only sets body overflow and listens for Escape; no focus trap, role, label, or focus restoration. `ConfirmDialog` and ad-hoc overlays have the same omissions.
- **Overlap:** No.

### 3. Tree phase action buttons are nested inside a button
- **Reproduction:** Tree → activate a node with keyboard or click one of the add/branch/delete icons inside the node. The outer node is a `<button>` containing three inner `<button>` elements.
- **Affected:** `src/features/tree/TreeView.tsx` node rendering.
- **Problem/impact:** Nested interactive controls are invalid HTML and produce inconsistent event/keyboard behavior across browsers and assistive technology. Users may open phase details when attempting an action, or be unable to reach inner actions predictably by keyboard.
- **Severity/confidence:** P1 / high.
- **Recommendation:** Render the node as a non-button/card with a separate full-width details button, or use sibling action controls outside the details button; give each action an accessible name.
- **Evidence:** Around the node map, the outer `<button>` encloses buttons titled “Create branch,” “Add phase,” and “Delete phase.”
- **Overlap:** No.

### 4. Archived season read-only state is inconsistent
- **Reproduction:** Select an archived season → Inventory → add/edit/delete sections/items. Timeline and Tree hide structural editing for the same archived season, but Inventory sets `const isArchived = false`.
- **Affected:** `src/features/inventory/InventoryView.tsx`; cross-view lock/archive behavior.
- **Problem/impact:** Users are told “Archived season (read-only)” by the season selector, yet can mutate its inventory. This undermines trust in archive protection and can corrupt historical records.
- **Severity/confidence:** P1 / high.
- **Recommendation:** Derive `isArchived` from `seasons[appState.year]?.status !== 'current'` and disable all inventory mutations, with a clear read-only explanation.
- **Evidence:** Inventory explicitly hard-codes `const isArchived = false // Inventory not year-locked in mockup`; archive state is otherwise computed in Timeline/Tree.
- **Overlap:** No.

### 5. Layout is a fixed phone frame rather than a responsive application surface
- **Reproduction:** Open on a wide desktop: all views remain inside `max-w-md` (~448px) with large unused page margins. Open on a short mobile viewport: the screen remains `h-[792px] max-h-[90vh]`, forcing a very compressed scroll area and fixed bottom navigation.
- **Affected:** `src/components/AppShell.tsx` and all views.
- **Problem/impact:** Desktop users get little benefit from available width; mobile users have reduced working area and more nested scrolling. Tree and calendar are particularly dense in the narrow frame, while dialogs/menus can approach the viewport edges.
- **Severity/confidence:** P2 / high.
- **Recommendation:** Make the shell responsive: use full width/height on mobile, a sensible max-width only where appropriate, and a desktop layout that expands content. Prefer `min-height: 100dvh` and safe-area padding for mobile.
- **Evidence:** Shell uses `max-w-md`, inner `h-[792px] max-h-[90vh]`, and outer `p-4 md:p-10`.
- **Overlap:** Partial: `BUG_5_UX_REFINEMENTS.md` covers season-list behavior/background, not the fixed shell.

### 6. Small/hover-only controls reduce touch and keyboard discoverability
- **Reproduction:** On a touch device, open the project menu → try to delete a project; the trash control has `opacity-0 group-hover:opacity-100`, so there is no hover state. Header members/settings/lock/user controls are 24px, and many item delete/action controls are 24–28px.
- **Affected:** `src/components/Header.tsx`, `SeasonSelector.tsx`, Timeline/Tree/Library/Inventory action controls.
- **Problem/impact:** Destructive actions are undiscoverable on touch and small targets are difficult to activate accurately. `title` attributes are not a sufficient touch or screen-reader label strategy.
- **Severity/confidence:** P2 / high.
- **Recommendation:** Keep actions visible or expose them through a clearly labelled overflow menu; target at least 44×44 CSS px for touch; add `aria-label`, visible text in expanded menus, and clear focus styles.
- **Evidence:** Project delete button uses `opacity-0 group-hover:opacity-100`; header buttons use `w-6 h-6`; action buttons commonly use `w-5 h-5`/`w-6 h-6`.
- **Overlap:** No.

### 7. Timeline status and alerts are easy to miss or misleading
- **Reproduction:** In unlocked Timeline, inspect phases with statuses. Status badges are not rendered unless `isLocked`; for a check dated in the past on a non-done phase, the alert can say it “is coming up.”
- **Affected:** `src/features/timeline/TimelineView.tsx` / `PhaseCard` and `getPhaseAlert`.
- **Problem/impact:** Edit mode is the default working mode, so users cannot quickly scan status without opening each phase or locking the app. Overdue work is not distinguished from upcoming work, weakening planning decisions.
- **Severity/confidence:** P2 / high.
- **Recommendation:** Always show a compact status badge (with text, not color alone); distinguish overdue/today/upcoming and define alert-window behavior for negative days.
- **Evidence:** `PhaseCard` wraps status in `{isLocked && (...)}`; event alert checks only `days <= appState.eventAlertDays`, with no lower bound.
- **Overlap:** No.

### 8. Season context can vanish while scrolling
- **Reproduction:** Open a long Timeline/Inventory/Library view → scroll down more than 50px. The SeasonSelector applies `translateY(-100%)`, `opacity: 0`, and `maxHeight: 0`; the selected year and route to other seasons disappear until scrolling upward.
- **Affected:** `src/components/SeasonSelector.tsx`.
- **Problem/impact:** Users lose context about which season they are editing and cannot switch season at the point they realize they are in the wrong one. The disappearance is silent and can look like content reflow.
- **Severity/confidence:** P2 / high.
- **Recommendation:** Keep a compact sticky year indicator visible, or replace the hidden selector with a sticky “Season: YYYY” control; ensure the hide/show behavior is announced visually and not the only access path.
- **Evidence:** Scroll handler hides the entire selector, not only its expanded list.
- **Overlap:** Yes, partial: hide-on-scroll is explicitly listed in `BUG_5_UX_REFINEMENTS.md`; the recommendation to preserve context is additional.

### 9. Loading/error states do not give users a recovery path
- **Reproduction:** During initial auth/data load, the app shows plain “Loading…”; if the library snapshot is absent it shows “Loading library…” indefinitely. Several save/upload/delete failures use `alert()` and there is no inline retry or persisted error state.
- **Affected:** `src/App.tsx`, `src/components/LoadingSpinner.tsx`, `LibraryView.tsx`, and mutation handlers throughout features.
- **Problem/impact:** Users cannot tell whether loading is progressing, which resource failed, or how to retry without reloading. Browser alerts interrupt work and are inconsistent with the visual system.
- **Severity/confidence:** P2 / high.
- **Recommendation:** Add skeleton/spinner with status text, timeout/error states with Retry, inline or toast feedback, and preserve unsaved form context.
- **Evidence:** App fallback is a text-only `<div>Loading...</div>`; Library returns only “Loading library…”; handlers call `alert()` after errors.
- **Overlap:** No.

### 10. Calendar grid lacks accessible names and keyboard activation
- **Reproduction:** Use keyboard or screen reader in Calendar. Weekday headings are plain text, day cells are non-focusable `<div>`s, and event dots have no text alternative/count.
- **Affected:** `src/features/calendar/CalendarView.tsx`.
- **Problem/impact:** A calendar is effectively invisible to non-pointer users and event meaning is conveyed by color/position alone.
- **Severity/confidence:** P1 / high (also reinforces finding 1).
- **Recommendation:** Use semantic buttons/grid semantics with labels such as “March 12, 2 events,” include event titles/counts in an agenda, and ensure focus-visible styling.
- **Evidence:** Day cells are `<div>`s; event indicators are unlabeled 4px `<div>` dots.
- **Overlap:** No.

## Confirmed consistency/discoverability notes by area

- **Header/project selection:** Project switching is behind an unlabeled folder icon and project deletion is hover-only. Lock state is icon/title-driven and its distinction from archive is not explained inline.
- **Season selection:** The selector has good duplicate/delete confirmations and auto-collapse after create, but the whole control can disappear on scroll (finding 8). Its year picker is limited to current year ±5, which may surprise users managing older vintages.
- **Tree:** The visual tree is useful for structure and branch focus, but branch labels and tiny actions are dense on mobile; edge dimming is explicitly TODO (`isDim = false`), so focus only dims nodes, not connecting edges.
- **Timeline/editing:** Inline mutation on every keystroke (`onUpdate()` in `PhaseModal`) can feel laggy and offers no save/undo affordance; deleting a phase/branch is confirmed, but errors are browser alerts.
- **Inventory:** Item cards are clickable but have no visible “Edit” affordance, so first-time users must infer that clicking the entire card opens editing. Price has no currency/unit explanation beyond `$`.
- **Library:** Empty sections show four type buttons with no explanation of whether PDF/video fields accept URLs or uploads; uploaded media has no size/type/progress details beyond “Uploading…”.
- **Mobile/touch:** The app often uses 20–28px icon controls, and modal content can contain dense horizontal controls (event name + date + icon) that will be difficult at narrow widths.
- **Keyboard/accessibility:** Global `:focus-visible` exists, but many controls have no accessible name and dialogs do not trap/restore focus. There are no explicit live regions for async saves/errors.

## Suggestions (not confirmed defects)

1. Add a persistent top-level page title/subtitle per tab so the current destination remains clear when bottom-nav labels are out of view.
2. Add a compact agenda list under the calendar grid; it improves scanning and avoids relying on tiny dots even after day interaction is fixed.
3. Add undo for phase/branch/item deletion and autosave status (“Saved” / “Saving…”) for edits made directly in modal fields.
4. Offer a clear “Today” calendar control and preserve the user’s month choice when switching tabs/seasons where sensible.
5. Consider an explicit “Read-only: archived” banner in every affected view, not only the season selector.
6. Add empty-state examples or starter prompts in Library and Inventory to teach the intended organizational model.

## Validation

- `npm run build` passed successfully (TypeScript + Vite production build).
- Browser interaction testing was not available in this lane; behavior claims above are based on rendered JSX/event wiring and static implementation evidence.
