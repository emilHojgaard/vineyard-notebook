# Project Isolation Test Plan

## Test Categories

### 1. Project Isolation - Basic
**Goal:** Verify projects are completely independent

**Test Steps:**
1. Create Project A
2. Create season 2025 in Project A
3. Add custom phase "Malolactic Fermentation" to 2025
4. Create Project B
5. Verify Project B has NO 2025 season
6. Verify Project B has NO "Malolactic Fermentation" phase
7. Switch back to Project A
8. Verify season 2025 still exists with "Malolactic Fermentation"

**Expected Result:** ✅ Projects share zero data

---

### 2. Season Independence Within Project
**Goal:** Verify seasons don't share tree/calendar/inventory

**Test Steps:**
1. In Project A, create season 2024
2. In season 2024, add phase "Oak Barrel Aging"
3. Switch to season 2025
4. Verify "Oak Barrel Aging" is NOT in 2025's tree
5. Add different phase "Experimental Blend" to 2025
6. Switch back to 2024
7. Verify "Experimental Blend" is NOT in 2024's tree

**Expected Result:** ✅ Seasons have independent trees

---

### 3. Library Sharing Within Project
**Goal:** Verify library is shared only within project

**Test Steps:**
1. In Project A, add library entry "Winemaking Guide 2024" 
2. Switch to Season 2025 (same project)
3. Verify library entry "Winemaking Guide 2024" is visible
4. Switch to Project B
5. Verify "Winemaking Guide 2024" is NOT visible in Project B
6. Add library entry "Barrel Cleaning SOP" to Project B
7. Switch to Project A
8. Verify "Barrel Cleaning SOP" is NOT visible in Project A

**Expected Result:** ✅ Library shared within project, isolated between projects

---

### 4. Inventory Isolation Per Season
**Goal:** Verify inventory is per-season, not shared

**Test Steps:**
1. In Project A Season 2024, add inventory item "Oak Barrel #5"
2. Switch to Season 2025
3. Verify "Oak Barrel #5" is NOT in 2025 inventory
4. Add inventory item "Stainless Steel Tank #2" to 2025
5. Switch back to 2024
6. Verify "Stainless Steel Tank #2" is NOT in 2024 inventory
7. Verify "Oak Barrel #5" is still in 2024 inventory

**Expected Result:** ✅ Each season has independent inventory

---

### 5. Multi-Project Workflow
**Goal:** Verify switching projects maintains isolation

**Test Steps:**
1. Create 3 projects: "Vineyard A", "Vineyard B", "Vineyard C"
2. In each project, create different seasons and data:
   - Vineyard A: 2024 season with "Estate Pinot Noir" phase
   - Vineyard B: 2025 season with "Chardonnay Barrel Ferment" phase
   - Vineyard C: 2026 season with "Rosé Pressing" phase
3. Switch between projects multiple times
4. Verify each project maintains its own data
5. Edit Vineyard B data
6. Verify Vineyard A and C are unaffected

**Expected Result:** ✅ No cross-contamination between projects

---

### 6. Firestore Structure Verification
**Goal:** Verify data is correctly partitioned in Firestore

**Test Steps:**
1. Create Project A with ID "proj_123"
2. Create season 2024
3. Verify Firestore document path: `/seasons/proj_123_2024`
4. Verify Firestore document path: `/inventory/proj_123_2024`
5. Verify Firestore document path: `/library/proj_123`
6. Create Project B with ID "proj_456"
7. Verify completely separate paths in Firestore

**Expected Result:** ✅ Firestore correctly scoped by projectId

---

## Test Results

Date: [To be filled]
Tester: Autonomous Worker Agent

| Test Category | Status | Notes |
|--------------|--------|-------|
| 1. Project Isolation - Basic | [ ] | |
| 2. Season Independence | [ ] | |
| 3. Library Sharing | [ ] | |
| 4. Inventory Isolation | [ ] | |
| 5. Multi-Project Workflow | [ ] | |
| 6. Firestore Structure | [ ] | |

---

## Implementation Verification Checklist

✅ DataContext state scoped by projectId
✅ Computed accessors for current project (seasons, inventory, library)
✅ All functions use currentProject.id
✅ Backward compatibility maintained (views don't need changes)
✅ Build passes without errors
✅ Dev server starts successfully

**Status:** Implementation complete, ready for functional testing
