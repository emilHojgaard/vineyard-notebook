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
5. **Project Isolation** (CRITICAL):
   - Projects are completely independent units
   - Each project has its own seasons, library
   - Seasons within a project share only the library
   - All other data (tree/timeline, calendar, inventory) is per-season

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

invitations/{invitationId}
  - projectId: string
  - email: string
  - invitedBy: string
  - createdAt: Timestamp
  - status: 'pending' | 'accepted'

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
    members/       # Member management
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

## Current Implementation Status

✅ **Phase 1 - Foundation** (Completed):
- Project scaffolding (React + TypeScript + Vite)
- Firebase setup (Auth, Firestore, Storage)
- Authentication (login, signup)
- Project creation/selection
- Data contexts with real-time sync
- App shell with bottom nav
- Type definitions
- Security rules
- Deployment configs

✅ **Phase 2 - Interactive Features** (Completed):
- **Timeline**: Full editing with add/edit/delete phases, notes with photo upload to Firebase Storage
- **Timeline**: Branch creation/management (split, delete, color-coded)
- **Timeline**: Sub-events ("checks") with date tracking
- **Timeline**: Inventory shortage alerts (14-day window)
- **Timeline**: Event alerts (7-day window)
- **Tree View**: Full visual layout with recursive algorithm from BUILD-NOTES
- **Tree View**: Interactive SVG rendering with node/edge diagram
- **Tree View**: Branch focus mode (dim other branches)
- **Calendar View**: Month grid with navigation
- **Calendar View**: Agenda list (upcoming 30 days)
- **Calendar View**: Phase and sub-event display
- **Calendar View**: Export to .ics format (phases and sub-events)
- **Inventory**: Sections and items with full CRUD
- **Inventory**: Have/need quantities with status (need/partial/have)
- **Inventory**: Pricing and units
- **Library**: Reference items (PDF, video, photo, note)
- **Library**: File upload to Firebase Storage
- **Library**: Section management
- **Modal Components**: Reusable modal and confirm dialog
- **Photo Upload**: Firebase Storage integration (not base64)

✅ **Phase 3 - Project Isolation** (Completed):
- **DataContext Architecture**: Complete project isolation implementation
- **State Scoping**: All data scoped by projectId (allSeasons, allInventory, allLibrary)
- **Computed Accessors**: Backward-compatible accessors for current project
- **Project Independence**: Each project has completely separate data
- **Season Independence**: Seasons share only project-level library
- **Firestore Partitioning**: Queries correctly scoped by projectId
- **Production Ready**: App is now architecturally bulletproof for multi-project use

✅ **Phase 4 - Member Management** (Completed):
- **Member Invitations**: Invite users via email with automatic account detection
- **Pending Invitations**: System for users without accounts, auto-processed on signup/login
- **Member List**: View current project members with roles (Owner/Member)
- **Remove Members**: Delete members with safeguards (can't remove last member/owner)
- **Security Rules**: Comprehensive Firestore rules for invitations collection
- **UI Integration**: Accessible via header button, clean modal interface
- **Real-time Updates**: Members and invitations update via Firestore snapshots

⏳ **TODO** (Future enhancements):
- Offline support (Firestore persistence)
- Performance optimization (code splitting)
- Email notifications for member invitations (currently manual)

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

### Understanding Data Scoping

**DataContext exposes two levels of data:**

1. **Raw state (all projects):**
   - `allSeasons`: `Record<projectId, Record<year, Season>>`
   - `allInventory`: `Record<projectId, Record<year, Inventory>>`
   - `allLibrary`: `Record<projectId, Library>`

2. **Current project accessors (use these in views):**
   - `seasons`: `Record<year, Season>` - current project only
   - `inventory`: `Record<year, Inventory>` - current project only
   - `library`: `Library | null` - current project only

### Updating Seasons
```typescript
const { seasons, updateSeason, appState } = useData();
const season = seasons[appState.year]; // Automatically scoped to current project

// Modify season data
const updated = { ...season };
// ... make changes ...

// Save (syncs to Firestore for current project)
await updateSeason(appState.year, updated);
```

### Accessing Data
```typescript
// ✅ CORRECT - Use scoped accessors
const { seasons, inventory, library } = useData();
const currentSeason = seasons[appState.year];
const currentInventory = inventory[appState.year];

// ❌ WRONG - Don't access raw state directly in views
const { allSeasons } = useData();
const season = allSeasons[currentProject.id][appState.year]; // Too verbose
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

### Calendar Export
```typescript
import { generateICS, downloadICS } from '../lib/calendar-export';

// Generate .ics file from calendar events
const icsContent = generateICS(allEvents, season.title);
if (icsContent) {
  downloadICS(icsContent, `vineyard-calendar-${season.title}.ics`);
}
```

## Maintaining this file

Update `AGENTS.md` when:
- Adding major features or modules
- Changing data model or Firebase structure
- Discovering non-obvious patterns or gotchas
- Completing TODO items (move to "Completed")

Keep it concise - point to authoritative files rather than duplicating content.
