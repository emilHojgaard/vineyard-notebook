# Performance optimization: lazy feature loading

## Implementation

The application keeps the authentication and project-setup paths in the initial route, while feature views are loaded only when their tab is rendered:

- `src/App.tsx` uses `React.lazy()` for Timeline, Tree, Calendar, Inventory, and Library.
- `src/components/AppShell.tsx` lazy-loads the Members overlay because it is opened on demand.
- Existing named feature exports remain available; lazy imports use each view's default export (and the Members import maps its named export).
- `Suspense` boundaries keep the shell usable while a feature chunk is fetched.

`src/components/LoadingSpinner.tsx` is the shared fallback. It exposes a `role="status"` live region, an explicit loading label, and hides the decorative animation from assistive technology. The compact variant is used for the Members overlay; the full-page variant is used during initial data loading.

## Chunk policy

`vite.config.ts` keeps React and Firebase in separately cacheable vendor chunks. Dynamic feature imports retain descriptive entry names and use `assets/[name]-[hash].js`, so unchanged vendor/feature chunks can be reused across deployments while changed files receive new cache keys. No feature is forced into a manual chunk when it is not lazy-loaded.

## Bundle evidence

Measured with `npm run build` (Vite 6.4.3):

| Output | Raw | Gzip | Loading behavior |
| --- | ---: | ---: | --- |
| `index-Ci1z4Mqj.js` | 76.62 kB | 22.41 kB | Initial application entry |
| `react-vendor-DRGAkOw0.js` | 142.24 kB | 45.61 kB | Shared vendor |
| `firebase-BbNYaPud.js` | 614.90 kB | 146.51 kB | Shared vendor |
| `TimelineView-CYAcDjRh.js` | 13.37 kB | 4.05 kB | Lazy feature |
| `TreeView-CpPes_BA.js` | 15.71 kB | 5.41 kB | Lazy feature |
| `CalendarView-C4Dc5Kuj.js` | 99.12 kB | 30.58 kB | Lazy feature |
| `InventoryView-Bqbgg5pV.js` | 13.34 kB | 4.07 kB | Lazy feature |
| `LibraryView-BUUGxnnh.js` | 11.28 kB | 3.17 kB | Lazy feature |
| `MembersView-Kvqm8-6S.js` | 6.63 kB | 2.16 kB | Lazy overlay |

The build confirms that inactive feature views are emitted separately from the application entry. These sizes document the split topology; they do not claim a real-world performance gain without a comparable baseline or browser measurement.

## Validation

- `npm run build` passes (TypeScript plus production Vite build).
- `npm test` passes (18 tests).
- `npm run lint` is currently unavailable because the repository has no ESLint 9 flat config (`eslint.config.js/mjs/cjs`); this is unrelated to the changes here.
