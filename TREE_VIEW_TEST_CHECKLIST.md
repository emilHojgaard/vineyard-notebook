# Tree View Fix - Test Checklist

Use this checklist to verify that the Tree view fix is working correctly.

## ✅ Pre-Deployment Tests (Required)

### Test 1: All Phases Visible
**Steps:**
1. Open the app and go to Timeline view
2. Count the number of phases visible
3. Switch to Tree view
4. Count the number of phases visible

**Expected Result:**
- ✅ Both views show SAME number of phases
- ✅ No phases are missing in Tree view

---

### Test 2: Same Phase Names
**Steps:**
1. In Timeline view, write down all phase names
2. Switch to Tree view
3. Check that all the same phase names appear

**Expected Result:**
- ✅ All phase names from Timeline appear in Tree
- ✅ No extra phases in Tree
- ✅ No missing phases in Tree

---

### Test 3: Branching Display
**Steps:**
1. In Timeline view, create a branch:
   - Click the + icon next to a phase's branch tabs
   - Enter a branch name (e.g., "Red Wine")
   - Add 2-3 phases to the new branch
2. Switch to Tree view

**Expected Result:**
- ✅ All phases from BOTH branches appear in Tree
- ✅ Branch structure is clear and coherent
- ✅ Branch names appear as labels
- ✅ Phases are connected to their parent branch node

---

### Test 4: Nested Branching
**Steps:**
1. In Timeline view, create a nested branch:
   - Navigate into a branch
   - Split one of the branch's phases
   - Add phases to the sub-branches
2. Switch to Tree view

**Expected Result:**
- ✅ All nested phases appear in Tree
- ✅ Hierarchy is clear (trunk → branch → sub-branch)
- ✅ All levels are visible
- ✅ No phases are hidden

---

### Test 5: Season Switching
**Steps:**
1. In Tree view, note the current season's phases
2. Switch to a different season using the season selector
3. Check the phases displayed

**Expected Result:**
- ✅ Tree updates to show new season's phases
- ✅ All phases from new season appear
- ✅ No phases from old season remain
- ✅ Count is correct for new season

---

### Test 6: Edit Mode Toggle
**Steps:**
1. In Tree view with a season containing phases
2. Lock the editor (click lock icon)
3. Verify phases still show
4. Unlock the editor
5. Verify phases still show

**Expected Result:**
- ✅ Phases visible when locked
- ✅ Phases visible when unlocked
- ✅ Edit mode toggle doesn't hide phases
- ✅ Delete icons appear/disappear correctly

---

## ✅ Edge Cases to Test

### Test 7: Empty Season
**Steps:**
1. Create a new season with no phases
2. Switch to Tree view

**Expected Result:**
- ✅ Shows "No phases yet" message
- ✅ Suggests adding phases in Timeline tab
- ✅ No errors in console

---

### Test 8: Single Phase
**Steps:**
1. Create a season with only 1 phase
2. Switch to Tree view

**Expected Result:**
- ✅ Single phase appears
- ✅ Shows "1 phase" (singular)
- ✅ Layout is centered and looks good

---

### Test 9: Complex Tree
**Steps:**
1. Create a season with:
   - 3 trunk phases
   - Split at phase 2 into 2 branches
   - Each branch has 2-3 phases
   - Split one branch phase into 2 sub-branches
2. Switch to Tree view

**Expected Result:**
- ✅ All trunk phases appear (3)
- ✅ All branch phases appear (4-6)
- ✅ All sub-branch phases appear
- ✅ Total count matches Timeline
- ✅ Structure is coherent and readable

---

### Test 10: Branch Focus
**Steps:**
1. In Tree view with multiple branches
2. Click on a branch name to focus it
3. Verify dimming behavior
4. Click "Clear focus"

**Expected Result:**
- ✅ Focused branch remains fully visible
- ✅ Other branches dim correctly
- ✅ Focused branch phases are NOT dimmed
- ✅ Clear focus restores all branches

---

## ✅ Integration Tests

### Test 11: Timeline and Tree Consistency
**Steps:**
1. Add a phase in Timeline
2. Switch to Tree → verify it appears
3. Delete a phase in Timeline
4. Switch to Tree → verify it's gone
5. Edit a phase name in Timeline
6. Switch to Tree → verify name updated

**Expected Result:**
- ✅ Changes in Timeline reflected in Tree
- ✅ No sync issues
- ✅ Counts always match

---

### Test 12: Phase Modal Integration
**Steps:**
1. In Tree view, click on a phase
2. Phase modal should open
3. Close modal
4. Phases still visible

**Expected Result:**
- ✅ Modal opens correctly
- ✅ Shows correct phase data
- ✅ Tree view remains functional after closing modal

---

## ✅ Performance Tests

### Test 13: Large Season
**Steps:**
1. Create a season with 20+ phases
2. Create multiple branches
3. Switch to Tree view
4. Check rendering performance

**Expected Result:**
- ✅ All phases render
- ✅ No lag or slowdown
- ✅ Layout is coherent despite size
- ✅ Scrolling works smoothly

---

## 🐛 Known Issues to Watch For

### Issues That Should NOT Occur:
- ❌ Missing phases in Tree view
- ❌ Duplicate phases
- ❌ Phases from wrong season
- ❌ Broken layout (overlapping nodes)
- ❌ Disconnected branches
- ❌ Console errors
- ❌ Crash when switching views

### If Any Issue Occurs:
1. Note the exact steps to reproduce
2. Check browser console for errors
3. Verify Timeline view shows correct data
4. Report issue with:
   - Steps to reproduce
   - Expected behavior
   - Actual behavior
   - Console errors (if any)

---

## ✅ Success Criteria

All tests must pass for the fix to be considered successful:

- [ ] Test 1: All Phases Visible
- [ ] Test 2: Same Phase Names
- [ ] Test 3: Branching Display
- [ ] Test 4: Nested Branching
- [ ] Test 5: Season Switching
- [ ] Test 6: Edit Mode Toggle
- [ ] Test 7: Empty Season
- [ ] Test 8: Single Phase
- [ ] Test 9: Complex Tree
- [ ] Test 10: Branch Focus
- [ ] Test 11: Timeline and Tree Consistency
- [ ] Test 12: Phase Modal Integration
- [ ] Test 13: Large Season

**All tests must pass before deployment.**
