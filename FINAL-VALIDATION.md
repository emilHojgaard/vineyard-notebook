# Final validation

Validation was run after the four prerequisite batches were present in local `main`:

- security hardening (`31c273e`)
- data integrity (`f05f62d`)
- performance splitting (`0bd6375`)
- accessibility polish (`4b628f6`)

Environment: Node/npm from Node `v24.19.0`; Firebase CLI from the repository dependency (`15.30.2`).

## Automated results

| Check | Result |
| --- | --- |
| `npm test` | **PASS** — 18/18 tests |
| `npm run build` | **PASS** — TypeScript and Vite production build completed; separate chunks emitted for Timeline, Tree, Calendar, Inventory, and Library |
| `npm --prefix functions run build` | **PASS** — TypeScript functions build completed |
| `npm run test:rules` | **PASS** — Firestore/Storage emulators ran; 5/5 rules tests passed. Permission-denied lines in emulator output were expected negative assertions. |
| `npm run lint` | **FAIL (exit 2)** — ESLint 9.39.5 could not find `eslint.config.js`, `eslint.config.mjs`, or `eslint.config.cjs`. No lint rules ran. |

## Regression checklist

- **Security boundaries:** PASS through emulator rules tests (member/outsider Firestore and Storage access, owner-only membership changes, invitation access).
- **IDs, dates, and tree deletion:** PASS through unit tests (duplicate persisted IDs, completion/date guards, nested/root deletion and branch invariant cases).
- **Dialogs and calendar accessibility:** STATIC REVIEW PASS for dialog semantics, labels, Escape handling, focus restoration/trapping, calendar navigation labels, and keyboard event opening. Interactive browser run was not completed (see limitations).
- **Edit-mode gating:** STATIC REVIEW PASS for current/archived and locked/unlocked guards across timeline, tree, calendar, inventory, and library. Interactive auth-backed verification was not completed (see limitations).
- **Lazy-loaded views:** PASS at build level; all five feature views are `lazy()` imports and production chunks were emitted. Runtime tab navigation was not completed (see limitations).

## Limitations and readiness

`chrome-devtools-axi` could not maintain a browser page in this environment: its `snapshot`/`eval` calls returned `Required at pageId`, then the bridge reported `Target.setDiscoverTargets: Target closed` and `pages: 0`. No configured Firebase credentials or authenticated test account were available either. Therefore the interactive portions of the checklist remain unverified.

**Main is not ready for captain approval yet:** all tests, builds, and emulator checks pass, but the lint command is currently unusable because the repository has no ESLint 9 flat-config file, and interactive browser regression remains environment-limited. No product behavior was changed by this validation.
