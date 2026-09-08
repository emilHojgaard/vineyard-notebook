# Test Verification Plan

## Manual Testing Steps

### Setup
1. Start the dev server: `npm run dev`
2. Login/create a project
3. Navigate to Timeline tab
4. Create a season if needed

---

## Fix 1: Empty Branches in Tree View

### Test 1.1: Create Empty Branch
**Steps**:
1. In Timeline, click on any phase
2. Click "Split into branches"
3. Create a new branch (e.g., "Red Wine")
4. Leave the branch empty (don't add any phases)
5. Switch to Tree view

**Expected**:
- ✅ Empty branch appears in Tree view
- ✅ Branch label is visible
- ✅ Edge connects parent to empty branch point
- ✅ Branch structure is visible even with 0 phases

**Actual**: _[Fill in after testing]_

---

### Test 1.2: Multiple Empty Branches
**Steps**:
1. In Timeline, click on a phase
2. Create 3 branches: "Red", "White", "Rosé"
3. Leave all branches empty
4. Switch to Tree view

**Expected**:
- ✅ All 3 empty branches visible in Tree
- ✅ All 3 branch labels displayed
- ✅ Branches spread horizontally from parent
- ✅ Edges connect parent to each branch

**Actual**: _[Fill in after testing]_

---

### Test 1.3: Mix of Empty and Filled Branches
**Steps**:
1. Create 2 branches from a phase
2. Add phases to first branch only
3. Leave second branch empty
4. Switch to Tree view

**Expected**:
- ✅ First branch shows with its phases
- ✅ Second branch shows as empty (with label and edge)
- ✅ Both branches visible in tree structure
- ✅ Layout is clean and readable

**Actual**: _[Fill in after testing]_

---

### Test 1.4: Add Phase to Empty Branch
**Steps**:
1. Create an empty branch in Timeline
2. Verify it appears in Tree (empty)
3. Add a phase to that branch in Timeline
4. Switch back to Tree view

**Expected**:
- ✅ Tree updates to show the new phase
- ✅ Branch is no longer "empty" - shows phase node
- ✅ Branch label remains in correct position
- ✅ Edge now connects to first phase

**Actual**: _[Fill in after testing]_

---

## Fix 2: Delete Phase Promotes Branches

### Test 2.1: Delete Phase with Single Branch
**Steps**:
1. Create a phase with 2 branches
2. Delete one branch (leaving 1 branch)
3. Now you have a phase with 1 branch
4. Delete that phase

**Expected**:
- ✅ Phase is deleted
- ✅ Branch is NOT deleted
- ✅ Branch becomes child of the parent phase
- ✅ Branch contents preserved
- ✅ Timeline shows promoted branch
- ✅ Tree shows promoted branch

**Actual**: _[Fill in after testing]_

---

### Test 2.2: Delete Phase with Multiple Branches
**Steps**:
1. Create a phase
2. Split it into 3 branches: "Red", "White", "Rosé"
3. Add phases to each branch
4. Delete the parent phase

**Expected**:
- ✅ Parent phase is deleted
- ✅ All 3 branches are preserved
- ✅ All 3 branches become children of grandparent phase
- ✅ All branch contents intact
- ✅ Timeline shows all promoted branches
- ✅ Tree shows all promoted branches correctly positioned

**Actual**: _[Fill in after testing]_

---

### Test 2.3: Nested Branch Promotion
**Steps**:
1. Phase A → has 2 branches
2. Branch 1 has Phase B → which has 2 branches
3. Delete Phase B

**Expected**:
- ✅ Phase B is deleted
- ✅ Phase B's 2 branches are promoted to Branch 1
- ✅ Branch 1 now has Phase B's branches
- ✅ All nested contents preserved
- ✅ Tree structure correct at all levels

**Actual**: _[Fill in after testing]_

---

### Test 2.4: Auto-Collapse After Promotion
**Steps**:
1. Phase A has 2 branches: "Original" and "Red"
2. "Red" has Phase B with 2 sub-branches
3. Delete all phases in "Original" branch (empty it)
4. Delete "Original" branch
5. Now Phase A has only 1 branch ("Red")
6. Delete Phase A

**Expected**:
- ✅ Phase A is deleted
- ✅ "Red" branch is promoted
- ✅ Since parent now has only 1 branch, it auto-collapses
- ✅ "Red" branch nodes become direct children of grandparent
- ✅ Branch structure is clean (no single-branch nodes)

**Actual**: _[Fill in after testing]_

---

### Test 2.5: Root Level Phase with Branches
**Steps**:
1. Create branches on a root-level trunk phase
2. Delete that phase

**Expected**:
- ✅ Phase is deleted
- ✅ Branches are handled (edge case - see code comments)
- ✅ No crashes or errors
- ✅ Tree structure remains valid

**Actual**: _[Fill in after testing]_

---

## Integration Tests

### Test 3.1: Empty Branch → Add Phases → Delete Parent
**Steps**:
1. Create empty branch
2. Verify it shows in Tree
3. Add phases to it
4. Delete the parent phase

**Expected**:
- ✅ Empty branch visible in Tree initially
- ✅ After adding phases, Tree updates
- ✅ After deleting parent, branch is promoted
- ✅ All branch contents preserved

**Actual**: _[Fill in after testing]_

---

### Test 3.2: Timeline and Tree Consistency
**Steps**:
1. Perform various operations (create, delete, branch, promote)
2. Switch between Timeline and Tree views frequently

**Expected**:
- ✅ Both views always show same structure
- ✅ No divergence between views
- ✅ No phantom branches or phases
- ✅ No missing data

**Actual**: _[Fill in after testing]_

---

### Test 3.3: Firestore Persistence
**Steps**:
1. Create empty branch
2. Delete phase with branches
3. Refresh browser
4. Check that structure is preserved

**Expected**:
- ✅ Empty branches persist after reload
- ✅ Promoted branches persist after reload
- ✅ Tree structure matches before reload
- ✅ No data loss

**Actual**: _[Fill in after testing]_

---

## Regression Tests

### Test 4.1: Existing Features Still Work
**Steps**:
1. Add phase normally
2. Edit phase (name, dates, status)
3. Add notes to phase
4. Add sub-events to phase
5. Create normal branches (with phases)
6. Delete normal phases (no branches)
7. Navigate between tabs

**Expected**:
- ✅ All existing features work as before
- ✅ No errors or crashes
- ✅ No visual glitches
- ✅ No performance issues

**Actual**: _[Fill in after testing]_

---

### Test 4.2: Lock and Archive States
**Steps**:
1. Test fixes with locked season
2. Test fixes with archived season

**Expected**:
- ✅ Locked state prevents structural edits (as before)
- ✅ Archived state prevents all edits (as before)
- ✅ Fixes respect permission states
- ✅ No permission bypasses

**Actual**: _[Fill in after testing]_

---

## Edge Cases

### Test 5.1: Deeply Nested Structures
**Steps**:
1. Create branch → create branch → create branch (3+ levels)
2. Delete a middle-level phase with branches

**Expected**:
- ✅ Branches promoted correctly
- ✅ Tree structure remains valid
- ✅ No infinite loops or crashes
- ✅ Performance acceptable

**Actual**: _[Fill in after testing]_

---

### Test 5.2: Rapid Operations
**Steps**:
1. Rapidly create/delete phases and branches
2. Switch between Timeline and Tree during operations

**Expected**:
- ✅ No race conditions
- ✅ State stays consistent
- ✅ No duplicate branches
- ✅ No orphaned data

**Actual**: _[Fill in after testing]_

---

## Build and Deploy

### Test 6.1: Build Process
```bash
npm run build
```

**Expected**:
- ✅ Build succeeds
- ✅ No TypeScript errors
- ✅ No warnings (except chunk size)
- ✅ Output files generated

**Actual**: ✅ PASSED (see commit aacb4f3)

---

### Test 6.2: Production Build
```bash
npm run preview
```

**Expected**:
- ✅ Production build runs
- ✅ All features work in production mode
- ✅ No console errors
- ✅ Performance acceptable

**Actual**: _[Fill in after testing]_

---

## Summary Checklist

- [ ] All Fix 1 tests pass (empty branches visible)
- [ ] All Fix 2 tests pass (branch promotion)
- [ ] All integration tests pass
- [ ] All regression tests pass
- [ ] All edge cases handled
- [ ] Build succeeds
- [ ] Production build works
- [ ] No existing features broken
- [ ] Ready for deployment

---

## Notes

_Add any observations, issues, or improvements here_

