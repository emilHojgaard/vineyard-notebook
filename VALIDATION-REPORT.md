# Integration validation report

Run on `fm/integration-validation-vineyard-09` after rebasing onto local `main` (`94443bc`, 2026-09-22 UTC).

## Automated validation

| Command | Result |
|---|---|
| `npm test` | **PASS** — 18/18 tests |
| `npm run test:rules` | **PASS** — Firestore/Storage emulators, 5/5 tests |
| `npm run build` | **PASS** — TypeScript and Vite production build (152 modules) |
| `npm --prefix functions run build` | **PASS** — TypeScript build |
| `npm run lint` | **ENVIRONMENTAL FAIL** — ESLint 9 exits 2 because the repository has no `eslint.config.js/mjs/cjs` |
| `npx --yes oxlint .` (supplemental) | **PASS with warnings** — exit 0, 0 errors, 46 existing warnings |

The functions build initially could not resolve dependencies because `functions/node_modules` was absent. `npm --prefix functions ci` installed the locked dependencies, with the existing Node 24-vs-functions-Node-18 engine warning and npm audit warnings (10 dependency vulnerabilities reported). The subsequent functions build passed.

Generated `functions/lib` output was restored after validation; no product source was changed.

## Focused regression checklist

The relevant code paths were manually reviewed against the requested checklist and the repository-backed mutation tests passed:

- **Calendar event entry:** `DayEventsModal` creates checks with a generated ID and selected calendar date, calls `updateSeason`, and refreshes the event list; archived seasons hide add/delete controls.
- **Edit-mode gating:** `PhaseModal` keeps structural deletion gated by `isLocked`, while notes/checks remain editable when locked; archived seasons are read-only. Tree structural controls are hidden when locked or archived.
- **Today/month navigation:** `CalendarView` persists `calMonth`, supports previous/next month, and resets to the current month through Today; current-year seasons default to the current month.
- **Tree focus:** branch labels update shared `focusedBranchId`; node and edge dimming uses the shared highlighted-node set, and Clear focus resets it.
- **Undo:** phase/branch deletion stores before/after snapshots and the notification action restores only when the current season still matches the post-delete snapshot.
- **Repository-backed mutations:** the full test suite passed, including repository boundary tests and tree operation tests; production and functions builds passed.

A live browser click-through was attempted with `chrome-devtools-axi` against the local Vite server. The installed bridge returned `MCP error -32602` (`take_snapshot`/`evaluate_script` required `pageId`) and reported zero pages, so authenticated runtime interaction could not be completed in this environment. No browser regression result is claimed here.

## Readiness

Automated tests, rules emulator checks, production build, and functions build are green. This branch is clean and fast-forwarded onto local `main`. Captain approval should account for the pre-existing lint-script/configuration failure and the unavailable authenticated browser click-through before pushing.
