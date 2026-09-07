# Phase Creation UI Guide

## Button Location

### Timeline View
```
┌─────────────────────────────────────┐
│  Season  [2025 ▼]  [+]             │  ← "+" button here
└─────────────────────────────────────┘
│                                     │
│  ● Phase 1                          │
│  ● Phase 2                          │
│  ● Phase 3                          │
│                                     │
└─────────────────────────────────────┘
```

### Tree View
```
┌─────────────────────────────────────┐
│       2025 Vintage  [+]             │  ← "+" button here
│       3 phases                      │
└─────────────────────────────────────┘
│                                     │
│     [Phase 1] → [Phase 2]           │
│                      ↓              │
│                 [Phase 3]           │
│                                     │
└─────────────────────────────────────┘
```

## Modal UI

```
┌───────────────────────────────────┐
│ CREATE PHASE                  [X] │
├───────────────────────────────────┤
│                                   │
│ Phase Name *                      │
│ ┌───────────────────────────────┐ │
│ │ e.g. Harvest & Crush          │ │
│ └───────────────────────────────┘ │
│                                   │
│ Start Date (optional)             │
│ ┌───────────────────────────────┐ │
│ │ [date picker]                 │ │
│ └───────────────────────────────┘ │
│                                   │
│ End Date (optional)               │
│ ┌───────────────────────────────┐ │
│ │ [date picker]                 │ │
│ └───────────────────────────────┘ │
│                                   │
│ ┌──────────────┐ ┌──────────────┐ │
│ │ + Create Phase│ │   Cancel     │ │
│ └──────────────┘ └──────────────┘ │
└───────────────────────────────────┘
```

## User Flow

### Creating a Phase with Name Only
1. User clicks "+" button in Timeline or Tree
2. Modal opens with focus on name field
3. User types "Malolactic Fermentation"
4. User presses Enter or clicks "Create Phase"
5. Modal closes
6. Phase appears immediately in both Timeline and Tree
7. Phase has status "upcoming", empty dates

### Creating a Phase with Dates
1. User clicks "+" button
2. Modal opens
3. User types "Cold Stabilization"
4. User selects start date: 2025-12-01
5. User selects end date: 2025-12-15
6. User clicks "Create Phase"
7. Modal closes
8. Phase appears with dates
9. Status auto-calculated based on today's date

### Canceling Creation
1. User clicks "+" button
2. Modal opens
3. User starts typing, then changes mind
4. User clicks "Cancel" (or presses Escape, or clicks outside)
5. Modal closes
6. No phase created
7. Form resets (empty on next open)

## Edit Mode Behavior

### When Locked
- "+" button HIDDEN
- Cannot create new phases
- Existing phases can be viewed (read-only)

### When Archived
- "+" button HIDDEN
- Cannot create new phases
- All data read-only

### When Unlocked (Edit Mode)
- "+" button VISIBLE
- Can create new phases
- Can edit existing phases
- Can delete phases

## Technical Details

### Phase Creation Process
1. User inputs data in modal
2. Modal calls `onCreate(name, start?, end?)`
3. Handler calls `createPhase(year, name, start, end)`
4. DataContext creates Node object with:
   - Unique ID from `uid('n')`
   - Name from user input
   - Start/end dates (or empty strings)
   - Status: 'upcoming'
   - Empty arrays: notes, events, invIds, libIds
   - Branches: null
5. Node added to season.root array
6. statuses synced (auto-calculate from dates)
7. Season saved to Firestore
8. Local state updates via onSnapshot
9. Both Timeline and Tree re-render
10. New phase appears immediately

### Error Handling
- No project: Shows error alert
- No season: Shows error alert
- Network error: Shows error alert
- Invalid name: Button disabled, cannot submit
- All errors logged to console

### Data Persistence
- Saves to: `seasons/{projectId}_{year}`
- Real-time sync enabled
- Offline support (via Firestore cache)
- Changes appear across all devices immediately

## Keyboard Shortcuts
- `Enter` in name field → Create phase
- `Escape` anywhere in modal → Cancel
- `Tab` → Navigate between fields

## Accessibility
- Auto-focus on name field when modal opens
- Required field marked with visual indicator (*)
- Optional fields clearly labeled
- Disabled state for empty name
- Proper ARIA labels (via Modal component)

## Design Consistency
- Uses existing Modal component
- Follows app's color scheme (burgundy primary)
- Consistent spacing with other modals
- Same button styles as rest of app
- Dashed border style matches "add" buttons elsewhere
