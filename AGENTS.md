# Vineyard Notebook - Agent Guide

This file contains essential project knowledge for AI agents and developers working on the Vineyard Notebook.

## Project Overview

A collaborative winemaking management app for small vineyards (2-person teams). Built from the fully-functional HTML mockup in `design/vineyard-notebook.html`.

**Core principle**: "Captain" and "Partner" are the default user roles (not "Helper" - that was corrected by the captain).

## Architecture

### Tech Stack
- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS with wine-themed colors
- **Backend**: Firebase (Auth + Firestore + Storage)
- **Deployment**: Vercel or Netlify (free tier)

### Data Model

See `design/BUILD-NOTES.md` §3 for complete spec. Key points:

1. **Recursive tree structure**: `Node` contains `branches: Branch[]`, each Branch contains `nodes: Node[]`
2. **Branching invariant**: A node's `branches` is either `null` or has **2+ items** (never exactly 1)
3. **Status auto-sync**: Phases with both start/end dates derive status from today's date
4. **Two alert systems**: 
   - Inventory shortages (14-day window, configurable)
   - Sub-events/checks (7-day window, configurable)

### Firebase Collections

```
projects/{projectId}
  - name: string
  - members: string[]  // user IDs
  - createdBy: string
  - createdAt: Timestamp

users/{userId}
  - email: string
  - displayName: string

seasons/{projectId}_{year}
  - projectId: string
  - status: 'current' | 'completed'
  - title: string
  - root: Node[]

inventory/{projectId}_{year}
  - projectId: string
  - sections: InventorySection[]

library/{projectId}
  - sections: LibrarySection[]
```

### File Structure

```
src/
  components/       # Reusable UI (Icon, AppShell, etc.)
  features/         # Feature modules (one per tab)
    auth/          # Login, signup, project setup
    timeline/      # Phase timeline with notes
    tree/          # Visual tree diagram
    calendar/      # Month view
    inventory/     # Equipment & supplies
    library/       # Reference materials
  contexts/        # React contexts (AuthContext, DataContext)
  lib/             # Utilities (firebase.ts, utils.ts)
  types/           # TypeScript definitions
```

## Key Implementation Notes

### 1. Branch Color Logic (BUILD-NOTES §4.4)

Colors are **computed**, not stored:
- Top-level branches off trunk get palette colors
- Nested branches get shades of parent color
- See `lib/utils.ts`: `branchColor()`, `shadeColor()`

### 2. Tree Layout Algorithm (BUILD-NOTES §4.1)

`buildTreeLayout()` in the mockup uses **post-order traversal**:
- Straight runs = one vertical chain
- Forks create new columns
- Parent column = average of children's columns
- **Not yet implemented** in React version - uses mockup logic

### 3. Lock vs Archived (BUILD-NOTES §4.5)

Two read-only states:
- **Archived**: Season status !== 'current', blocks everything
- **Locked**: User toggle, blocks only structural edits (add/delete phase/branch)
  - Notes, dates, and item fields stay editable when locked

### 4. Photo Storage

- **Mockup**: Base64 in localStorage (not scalable)
- **Production**: Firebase Storage
  - Path: `projects/{projectId}/photos/{filename}`
  - Upload compressed (see `lib/utils.ts`: `readAndCompress()`)
  - Store URL in Firestore, not data

## Current Implementation Status (Phase 1)

✅ **Completed**:
- Project scaffolding (React + TypeScript + Vite)
- Firebase setup (Auth, Firestore, Storage)
- Authentication (login, signup)
- Project creation/selection
- Data contexts with real-time sync
- App shell with bottom nav
- Basic Timeline view (read-only)
- Type definitions
- Security rules
- Deployment configs

⏳ **TODO** (remaining Phase 1 work):
- Timeline: Add/edit/delete phases, notes with photo upload
- Timeline: Branch creation/management
- Tree view: Full visual layout
- Calendar view: Month grid + agenda
- Inventory: Sections, items, shortage alerts
- Library: Reference items, tagging to phases
- Member management: Invite/remove members
- Photo upload to Firebase Storage (replace base64)
- Offline support (cached reads, queued writes)

## Development Commands

```bash
npm install          # Install dependencies
npm run dev          # Start dev server
npm run build        # Production build
npm run preview      # Preview production build
```

## Firebase Setup

1. Create project at https://console.firebase.google.com
2. Enable Email/Password auth
3. Create Firestore database
4. Enable Storage
5. Deploy rules:
   ```bash
   firebase deploy --only firestore:rules
   firebase deploy --only storage:rules
   ```
6. Copy config to `.env`:
   ```
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_STORAGE_BUCKET=...
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   VITE_FIREBASE_APP_ID=...
   ```

## Design Reference

**Always consult**:
- `design/vineyard-notebook.html` - Working mockup with full UX
- `design/BUILD-NOTES.md` - Complete data model and logic

The HTML mockup is production-quality. When implementing features:
1. Read the mockup's implementation of that feature
2. Port logic + UX patterns to React
3. Replace localStorage with Firebase
4. Replace base64 photos with Storage URLs

## Common Patterns

### Updating Seasons
```typescript
const { seasons, updateSeason, appState } = useData();
const season = seasons[appState.year];

// Modify season data
const updated = { ...season };
// ... make changes ...

// Save (syncs to Firestore)
await updateSeason(appState.year, updated);
```

### Photo Upload
```typescript
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';

const photoRef = ref(storage, `projects/${projectId}/photos/${filename}`);
await uploadBytes(photoRef, file);
const url = await getDownloadURL(photoRef);
```

### Walking the Tree
```typescript
import { walkNodes } from '../lib/utils';

walkNodes(season.root, (node) => {
  // Process each node
});
```

## Maintaining this file

Update `AGENTS.md` when:
- Adding major features or modules
- Changing data model or Firebase structure
- Discovering non-obvious patterns or gotchas
- Completing TODO items (move to "Completed")

Keep it concise - point to authoritative files rather than duplicating content.
