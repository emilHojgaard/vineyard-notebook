# Unified Tree Model - Verification Guide

## Architecture Summary

**Before Refactor:**
- Timeline and Tree views had duplicate tree manipulation logic
- `findAndUpdateNode()`, `handleSplitPhase()`, `handleDeleteBranch()`, `handleAddPhase()` were duplicated in both views
- Risk of divergence between views due to different implementations

**After Refactor:**
- All tree operations centralized in DataContext
- Both views call the same functions: `addPhase()`, `updatePhase()`, `deletePhase()`, `addBranch()`, `deleteBranch()`
- Single source of truth: `season.root`
- Both views ALWAYS read from and modify the same tree structure

## Verification Test Cases

### 1. ✅ Unified Model Reads
**Test:** Add phase in Timeline → appears in Tree
- Go to Timeline view
- Add a new phase (e.g., "Test Phase 1")
- Switch to Tree view
- **Expected:** Phase appears in Tree view immediately

**Test:** Add phase in Tree → appears in Timeline
- Go to Tree view
- Click "+" on a phase to add after it
- Add a new phase (e.g., "Test Phase 2")
- Switch to Timeline view
- **Expected:** Phase appears in Timeline view immediately

**Test:** Delete phase in Timeline → deleted in Tree
- Go to Timeline view
- Delete a phase
- Switch to Tree view
- **Expected:** Phase is gone from Tree view

**Test:** Delete phase in Tree → deleted in Timeline
- Go to Tree view
- Delete a phase
- Switch to Timeline view
- **Expected:** Phase is gone from Timeline view

### 2. ✅ Mid-Tree Operations Don't Break Structure
**Test:** Add phase in middle of sequence → branches stay attached
- Create a sequence with branches: Phase A → Phase B (has 2 branches) → ...
- Add a new phase between A and B
- **Expected:** 
  - New phase appears between A and B
  - Phase B's branches remain intact
  - Visible in both Timeline and Tree views

**Test:** Delete phase in middle → tree stays coherent
- Create: Phase A → Phase B → Phase C (has branches)
- Delete Phase B
- **Expected:**
  - Phase B is removed
  - Phase A connects to Phase C
  - Phase C's branches remain intact
  - No broken references in either view

### 3. ✅ Branching Operations Sync
**Test:** Branch from phase in Timeline → visible in Tree
- Go to Timeline view
- Click branch icon on a phase
- Create a new branch (e.g., "Red Wine")
- Switch to Tree view
- **Expected:** 
  - Branch appears in Tree layout
  - Branch has inherited phases
  - Branch color is applied correctly

**Test:** Branch from phase in Tree → visible in Timeline
- Go to Tree view
- Click branch icon on a phase
- Create a new branch (e.g., "White Wine")
- Switch to Timeline view
- **Expected:**
  - Branch tabs appear under the phase
  - Can select and view the new branch
  - Branch has inherited phases

**Test:** Create branch with phases → shows in both views
- Create a branch from "Primary Fermentation"
- **Expected:**
  - Timeline: Branch tabs appear, can select branch, phases visible
  - Tree: Branch splits visually, phases appear in new column

**Test:** Delete branch in one view → deleted in other
- Create a branch
- Delete it from Timeline view
- Switch to Tree view
- **Expected:** Branch is gone from Tree
- Repeat in reverse (delete from Tree, check Timeline)

### 4. ✅ No Duplicate Operations
**Test:** Add phase once → shouldn't create duplicates
- Add a phase in Timeline
- Check Tree view
- **Expected:** Exactly one instance of the phase exists

**Test:** Delete phase once → completely gone
- Delete a phase in Timeline
- Check Tree view
- Refresh the page
- **Expected:** Phase is permanently deleted, not duplicated or partially removed

**Test:** No phantom phases in either view
- Perform several add/delete operations
- Check phase count in Timeline
- Check phase count in Tree
- **Expected:** Counts match, no phantom nodes

### 5. ✅ Data Persistence
**Test:** Perform operations in Timeline → Firestore updated correctly
- Add/delete/branch operations in Timeline
- Open Firestore console
- Check the seasons collection
- **Expected:** All changes reflected in Firestore

**Test:** Perform operations in Tree → Firestore updated correctly
- Add/delete/branch operations in Tree
- Open Firestore console
- Check the seasons collection
- **Expected:** All changes reflected in Firestore

**Test:** Refresh page → all changes persist
- Perform several operations in either view
- Hard refresh the browser (Ctrl+Shift+R)
- **Expected:** All changes are preserved

### 6. ✅ Recursive Branches Work
**Test:** Create branch from branch → shows in both views
- Create a branch from "Harvest & Crush" (e.g., "Red Wine")
- In that branch, create another branch from "Aging" (e.g., "Oak Barrel")
- **Expected:**
  - Timeline: Nested branch tabs work correctly
  - Tree: Branch-within-branch renders correctly

**Test:** Add phase to nested branch in Timeline → shows in Tree
- Navigate to a nested branch in Timeline
- Add a phase
- Switch to Tree view
- **Expected:** Phase appears in the nested branch column

**Test:** Add phase to nested branch in Tree → shows in Timeline
- Add a phase to a nested branch from Tree view
- Switch to Timeline view
- Navigate to that branch
- **Expected:** Phase appears in the branch

**Test:** Delete phase from nested branch → doesn't affect siblings
- In a nested branch, delete a phase
- Check sibling branches
- **Expected:** Only the target phase is deleted, siblings unchanged

## Success Criteria Checklist

- ✅ One canonical tree model in `season.root`
- ✅ Timeline reads from `season.root`
- ✅ Tree reads from `season.root`
- ✅ All operations go through DataContext
- ✅ No separate tree copies per view
- ✅ Add/delete phases in middle doesn't break tree
- ✅ Branches stay attached through operations
- ✅ Timeline and Tree always show identical data
- ✅ All 6 test categories can be verified
- ✅ Firestore persists all changes correctly
- ✅ No operation can create divergence between views
- ✅ Clean rebase onto 6f79ca6
- ✅ No TypeScript compilation errors
- ✅ Complete unified architecture

## Code Architecture

### DataContext.tsx - Centralized Operations

```typescript
// Single helper for all tree traversal
findAndUpdateNode(nodes, nodeId, updateFn)

// All tree operations
addPhase(year, name, options)        // Add phase anywhere
updatePhase(year, phaseId, updates)  // Update any phase
deletePhase(year, phaseId)           // Delete phase recursively
addBranch(year, parentNodeId, name)  // Create branch
deleteBranch(year, parentNodeId, branchId)  // Delete branch
```

### TimelineView.tsx - View Layer Only

```typescript
// Calls DataContext operations
handleAddPhase() → addPhase()
handleSplitPhase() → addBranch()
handleDeleteBranch() → deleteBranch()
handleDeletePhase() → deletePhase()

// Renders season.root
renderNodeList(season.root)
```

### TreeView.tsx - View Layer Only

```typescript
// Calls DataContext operations
handleAddPhase() → addPhase()
handleSplitPhase() → addBranch()
handleDeleteBranch() → deleteBranch()
handleDeletePhase() → deletePhase()

// Renders season.root
buildTreeLayout(season.root)
```

## Key Invariants Maintained

1. **Branching invariant**: A node's `branches` is either `null` or has 2+ items (never exactly 1)
2. **Tree structure**: All operations maintain valid tree structure
3. **Data sync**: Both views always see the same tree state
4. **Firestore sync**: All changes immediately persisted to Firestore
5. **No duplication**: Each phase exists exactly once in the tree

## Manual Testing Steps

1. Start dev server: `npm run dev`
2. Create a test project and season
3. Run through all test cases above
4. Monitor browser console for errors
5. Check Firestore console for correct data structure
6. Verify no duplicate operations or phantom phases

## Automated Verification (Future)

Consider adding integration tests that:
- Create a season with phases
- Perform operations in Timeline
- Verify Tree shows same data
- Perform operations in Tree
- Verify Timeline shows same data
- Check Firestore matches local state
