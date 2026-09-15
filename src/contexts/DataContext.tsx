import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthContext';
import type {
  Project,
  Season,
  Inventory,
  Library,
  AppState,
  Member,
  Node as PhaseNode,
  Branch,
} from '../types';
import { syncStatuses, createDefaultPhases, uid } from '../lib/utils';

interface DataContextType {
  currentProject: Project | null;
  projects: Project[];
  // Raw state (scoped by projectId)
  allSeasons: Record<string, Record<number, Season>>; // projectId -> year -> Season
  allInventory: Record<string, Record<number, Inventory>>; // projectId -> year -> Inventory
  allLibrary: Record<string, Library>; // projectId -> Library
  // Scoped accessors for current project
  seasons: Record<number, Season>; // current project's seasons
  inventory: Record<number, Inventory>; // current project's inventory
  library: Library | null; // current project's library
  appState: AppState;
  members: Member[];
  loading: boolean;
  focusedBranchId: string | null;
  setFocusedBranchId: (branchId: string | null) => void;
  createProject: (name: string) => Promise<string>;
  selectProject: (projectId: string) => void;
  createSeason: (year: number) => Promise<void>;
  deleteSeason: (year: number) => Promise<void>;
  updateSeason: (year: number, season: Season) => Promise<void>;
  addPhase: (year: number, name: string, options?: { parentNodeId?: string; branchId?: string; afterNodeId?: string }) => Promise<void>;
  updatePhase: (year: number, phaseId: string, updates: Partial<PhaseNode>) => Promise<void>;
  deletePhase: (year: number, phaseId: string) => Promise<void>;
  addBranch: (year: number, parentNodeId: string, branchName: string) => Promise<void>;
  deleteBranch: (year: number, parentNodeId: string, branchId: string) => Promise<void>;
  updateInventory: (year: number, inventory: Inventory) => Promise<void>;
  updateLibrary: (library: Library) => Promise<void>;
  updateAppState: (state: Partial<AppState>) => void;
  inviteMembers: (emails: string[]) => Promise<void>;
  removeMember: (memberId: string) => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [allSeasons, setAllSeasons] = useState<Record<string, Record<number, Season>>>({});
  const [allInventory, setAllInventory] = useState<Record<string, Record<number, Inventory>>>({});
  const [allLibrary, setAllLibrary] = useState<Record<string, Library>>({});
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [focusedBranchId, setFocusedBranchId] = useState<string | null>(null);

  // Computed values for current project (for backward compatibility with existing views)
  const seasons = currentProject ? (allSeasons[currentProject.id] || {}) : {};
  const inventory = currentProject ? (allInventory[currentProject.id] || {}) : {};
  const library = currentProject ? (allLibrary[currentProject.id] || null) : null;

  // Default app state
  const [appState, setAppState] = useState<AppState>({
    year: new Date().getFullYear(),
    tab: 'timeline',
    branchSelection: {},
    invFilter: 'all',
    calMonth: null,
    locked: false,
    alertDays: 14,
    eventAlertDays: 7,
    treeFocus: null,
  });

  // Load user's projects
  useEffect(() => {
    if (!currentUser) {
      setProjects([]);
      setCurrentProject(null);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'projects'),
      where('members', 'array-contains', currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedProjects = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      })) as Project[];

      setProjects(loadedProjects);

      // Auto-select first project if none selected
      if (loadedProjects.length > 0 && !currentProject) {
        setCurrentProject(loadedProjects[0]);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, [currentUser]);

  // Load project data when project changes
  useEffect(() => {
    if (!currentProject) return;

    const unsubscribers: (() => void)[] = [];

    // Load seasons
    const seasonsQuery = query(
      collection(db, 'seasons'),
      where('projectId', '==', currentProject.id)
    );
    unsubscribers.push(
      onSnapshot(seasonsQuery, (snapshot) => {
        const loadedSeasons: Record<number, Season> = {};
        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          const year = parseInt(doc.id.split('_')[2] || '0');
          if (year) {
            loadedSeasons[year] = data as Season;
            // Sync statuses on load
            syncStatuses(loadedSeasons[year].root);
          }
        });
        setAllSeasons((prev) => ({ ...prev, [currentProject.id]: loadedSeasons }));
      })
    );

    // Load inventory
    const inventoryQuery = query(
      collection(db, 'inventory'),
      where('projectId', '==', currentProject.id)
    );
    unsubscribers.push(
      onSnapshot(inventoryQuery, (snapshot) => {
        const loadedInventory: Record<number, Inventory> = {};
        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          const year = parseInt(doc.id.split('_')[2] || '0');
          if (year) {
            loadedInventory[year] = { sections: data.sections || [] };
          }
        });
        setAllInventory((prev) => ({ ...prev, [currentProject.id]: loadedInventory }));
      })
    );

    // Load library (project-wide, not per-year)
    const libraryDoc = doc(db, 'library', currentProject.id);
    unsubscribers.push(
      onSnapshot(libraryDoc, (snapshot) => {
        const lib = snapshot.exists() 
          ? (snapshot.data() as Library) 
          : { sections: [] };
        setAllLibrary((prev) => ({ ...prev, [currentProject.id]: lib }));
      })
    );

    // Load members
    loadMembers(currentProject.id);

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [currentProject]);

  const loadMembers = async (projectId: string) => {
    const projectDoc = await getDoc(doc(db, 'projects', projectId));
    if (!projectDoc.exists()) return;

    const projectData = projectDoc.data();
    const memberIds = projectData.members || [];

    // Load user data for each member
    const memberPromises = memberIds.map(async (uid: string) => {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (!userDoc.exists()) return null;
      const userData = userDoc.data();
      return {
        id: uid,
        email: userData.email || '',
        displayName: userData.displayName || 'Unknown',
        role: uid === projectData.createdBy ? 'owner' : 'member',
      } as Member;
    });

    const loadedMembers = (await Promise.all(memberPromises)).filter(Boolean) as Member[];
    setMembers(loadedMembers);
  };

  const createProject = async (name: string): Promise<string> => {
    if (!currentUser) throw new Error('Must be logged in');

    const projectId = `proj_${Date.now()}`;
    const year = new Date().getFullYear();

    // Create project
    await setDoc(doc(db, 'projects', projectId), {
      name,
      members: [currentUser.uid],
      createdBy: currentUser.uid,
      createdAt: Timestamp.now(),
    });

    // Create initial season with default winemaking phases
    const initialSeason: Season = {
      status: 'current',
      title: `${year}`,
      root: createDefaultPhases(),
    };
    
    // Sync statuses for the default phases
    syncStatuses(initialSeason.root);

    await setDoc(doc(db, 'seasons', `${projectId}_${year}`), {
      ...initialSeason,
      projectId,
    });

    // Create inventory with default sections
    await setDoc(doc(db, 'inventory', `${projectId}_${year}`), {
      projectId,
      sections: [
        { id: 'inv1', name: 'Equipment', items: [] },
        { id: 'inv2', name: 'Supplies', items: [] },
        { id: 'inv3', name: 'Chemicals/Additives', items: [] },
      ],
    });

    // Create library with empty sections
    await setDoc(doc(db, 'library', projectId), {
      sections: [],
    });

    // Create user document if it doesn't exist
    const userDocRef = doc(db, 'users', currentUser.uid);
    const userDoc = await getDoc(userDocRef);
    if (!userDoc.exists()) {
      await setDoc(userDocRef, {
        email: currentUser.email,
        displayName: currentUser.displayName || 'User',
      });
    }

    // Immediately set as current project (don't wait for snapshot)
    const newProject: Project = {
      id: projectId,
      name,
      members: [currentUser.uid],
      createdBy: currentUser.uid,
      createdAt: new Date(),
    };
    setCurrentProject(newProject);

    return projectId;
  };

  const selectProject = (projectId: string) => {
    const project = projects.find((p) => p.id === projectId);
    if (project) {
      setCurrentProject(project);
      
      // Update year to newest season in the new project
      const projectSeasons = allSeasons[projectId] || {};
      const availableYears = Object.keys(projectSeasons).map(Number);
      if (availableYears.length > 0) {
        const newestYear = Math.max(...availableYears);
        updateAppState({ year: newestYear });
      }
    }
  };

  const createSeason = async (year: number) => {
    if (!currentProject) throw new Error('No project selected');
    
    const initialSeason: Season = {
      status: 'current',
      title: `${year}`,
      root: createDefaultPhases(),
    };
    
    syncStatuses(initialSeason.root);
    
    await setDoc(doc(db, 'seasons', `${currentProject.id}_${year}`), {
      ...initialSeason,
      projectId: currentProject.id,
    });
    
    // Create inventory with default sections for this year
    await setDoc(doc(db, 'inventory', `${currentProject.id}_${year}`), {
      projectId: currentProject.id,
      sections: [
        { id: 'inv1', name: 'Equipment', items: [] },
        { id: 'inv2', name: 'Supplies', items: [] },
        { id: 'inv3', name: 'Chemicals/Additives', items: [] },
      ],
    });
  };

  const updateSeason = async (year: number, season: Season) => {
    if (!currentProject) return;
    syncStatuses(season.root);
    await setDoc(doc(db, 'seasons', `${currentProject.id}_${year}`), {
      ...season,
      projectId: currentProject.id,
    });
  };



  // Helper to find and update a node anywhere in the tree
  const findAndUpdateNode = (
    nodes: PhaseNode[],
    nodeId: string,
    updateFn: (node: PhaseNode, parentNodes: PhaseNode[], nodeIndex: number) => boolean
  ): boolean => {
    // Check if node is in this array
    const nodeIndex = nodes.findIndex((n) => n.id === nodeId);
    if (nodeIndex !== -1) {
      return updateFn(nodes[nodeIndex], nodes, nodeIndex);
    }

    // Recursively search in branches
    for (const node of nodes) {
      if (node.branches) {
        for (const branch of node.branches) {
          if (findAndUpdateNode(branch.nodes, nodeId, updateFn)) {
            return true;
          }
        }
      }
    }

    return false;
  };

  // Add a new phase to the tree
  const addPhase = async (
    year: number,
    name: string,
    options: { parentNodeId?: string; branchId?: string; afterNodeId?: string } = {}
  ) => {
    if (!currentProject) return;
    const season = seasons[year];
    if (!season) return;

    const newNode: PhaseNode = {
      id: uid('n'),
      name: name.trim(),
      start: '',
      end: '',
      status: 'upcoming',
      notes: [],
      events: [],
      invIds: [],
      libIds: [],
      branches: null,
    };

    const updatedSeason = JSON.parse(JSON.stringify(season));

    // Case 1: Add to trunk (no parent/branch specified)
    if (!options.parentNodeId && !options.branchId && !options.afterNodeId) {
      updatedSeason.root.push(newNode);
    }
    // Case 2: Add to specific branch
    else if (options.parentNodeId && options.branchId) {
      const found = findAndUpdateNode(
        updatedSeason.root,
        options.parentNodeId,
        (node) => {
          if (node.branches) {
            const branch = node.branches.find((b: Branch) => b.id === options.branchId);
            if (branch) {
              branch.nodes.push(newNode);
              return true;
            }
          }
          return false;
        }
      );
      if (!found) return;
    }
    // Case 3: Add after a specific node
    else if (options.afterNodeId) {
      const findAndAddAfter = (nodes: PhaseNode[]): boolean => {
        for (let i = 0; i < nodes.length; i++) {
          if (nodes[i].id === options.afterNodeId) {
            // If the node we're adding after has branches, transfer them to the new node
            if (nodes[i].branches && nodes[i].branches.length > 0) {
              newNode.branches = nodes[i].branches;
              nodes[i].branches = null;
            }
            nodes.splice(i + 1, 0, newNode);
            return true;
          }
          if (nodes[i].branches) {
            for (const branch of nodes[i].branches) {
              if (findAndAddAfter(branch.nodes)) return true;
            }
          }
        }
        return false;
      };
      const found = findAndAddAfter(updatedSeason.root);
      if (!found) {
        // If not found, add to trunk
        updatedSeason.root.push(newNode);
      }
    }

    await updateSeason(year, updatedSeason);
  };

  // Update a specific phase in the tree
  const updatePhase = async (
    year: number,
    phaseId: string,
    updates: Partial<PhaseNode>
  ) => {
    if (!currentProject) return;
    const season = seasons[year];
    if (!season) return;

    const updatedSeason = JSON.parse(JSON.stringify(season));

    const found = findAndUpdateNode(
      updatedSeason.root,
      phaseId,
      (node) => {
        Object.assign(node, updates);
        return true;
      }
    );

    if (found) {
      await updateSeason(year, updatedSeason);
    }
  };

  // Delete a phase from the tree
  const deletePhase = async (year: number, phaseId: string) => {
    if (!currentProject) return;
    const season = seasons[year];
    if (!season) return;

    const updatedSeason = JSON.parse(JSON.stringify(season));

    // Helper to find a node and its parent
    const findNodeAndParent = (
      nodes: PhaseNode[],
      targetId: string,
      parent: PhaseNode | null = null
    ): { node: PhaseNode; parent: PhaseNode | null; parentNodes: PhaseNode[]; nodeIndex: number } | null => {
      for (let i = 0; i < nodes.length; i++) {
        if (nodes[i].id === targetId) {
          return { node: nodes[i], parent, parentNodes: nodes, nodeIndex: i };
        }
        if (nodes[i].branches) {
          for (const branch of nodes[i].branches) {
            const result = findNodeAndParent(branch.nodes, targetId, nodes[i]);
            if (result) return result;
          }
        }
      }
      return null;
    };

    // Find the phase to delete
    const found = findNodeAndParent(updatedSeason.root, phaseId);
    if (!found) return;

    const { node, parent, parentNodes, nodeIndex } = found;

    // If the node has branches, promote them to the parent
    if (node.branches && node.branches.length > 0) {
      if (parent) {
        // If parent has branches, add to them
        if (parent.branches) {
          parent.branches.push(...node.branches);
        } else {
          // Parent doesn't have branches yet - transfer deleted node's branches to parent
          parent.branches = node.branches;
        }
      } else {
        // Node is in root - need to find the previous sibling to receive branches
        // If there's a previous sibling in the array, give it the branches
        if (nodeIndex > 0) {
          const prevNode = parentNodes[nodeIndex - 1];
          if (prevNode.branches) {
            prevNode.branches.push(...node.branches);
          } else {
            prevNode.branches = node.branches;
          }
        }
        // If no previous sibling, branches are lost (rare edge case)
        // This happens when deleting the FIRST trunk phase that has branches
      }
    }

    // Remove the node from its parent array
    parentNodes.splice(nodeIndex, 1);

    // If parent now has only 1 branch, collapse it
    if (parent && parent.branches && parent.branches.length === 1) {
      // Find parent's parent to splice nodes
      const findParentArray = (nodes: PhaseNode[], targetId: string): PhaseNode[] | null => {
        for (let i = 0; i < nodes.length; i++) {
          if (nodes[i].id === targetId) return nodes;
          if (nodes[i].branches) {
            for (const branch of nodes[i].branches) {
              const result = findParentArray(branch.nodes, targetId);
              if (result) return result;
            }
          }
        }
        return null;
      };

      const parentArray = findParentArray(updatedSeason.root, parent.id);
      if (parentArray) {
        const parentIdx = parentArray.findIndex((n) => n.id === parent.id);
        if (parentIdx !== -1) {
          const remainingBranch = parent.branches[0];
          // Splice remaining branch nodes after parent
          parentArray.splice(parentIdx + 1, 0, ...remainingBranch.nodes);
          parent.branches = null;
        }
      }
    }

    await updateSeason(year, updatedSeason);
  };

  // Add a new branch to a phase
  const addBranch = async (
    year: number,
    parentNodeId: string,
    branchName: string
  ) => {
    if (!currentProject) return;
    const season = seasons[year];
    if (!season) return;

    const updatedSeason = JSON.parse(JSON.stringify(season));

    const found = findAndUpdateNode(
      updatedSeason.root,
      parentNodeId,
      (node, parentNodes, nodeIndex) => {
        // If node doesn't have branches yet, create initial split
        if (!node.branches) {
          // Move any phases after this node into "Original" branch
          const afterNodes = parentNodes.splice(nodeIndex + 1);
          const originalBranch: Branch = {
            id: uid('b'),
            name: 'Original',
            nodes: afterNodes,
          };

          // Create new branch with phase inheritance
          const defaultPhases = createDefaultPhases();
          const parentPhaseIndex = defaultPhases.findIndex((p) => p.name === node.name);

          let newBranchNodes: PhaseNode[] = [];
          if (parentPhaseIndex !== -1) {
            // Copy the parent phase and all phases after it from defaults
            newBranchNodes = defaultPhases.slice(parentPhaseIndex).map((phase) => ({
              ...JSON.parse(JSON.stringify(phase)),
              id: uid('n'),
              notes: [],
              events: [],
            }));
          }

          const newBranch: Branch = {
            id: uid('b'),
            name: branchName.trim(),
            nodes: newBranchNodes,
          };

          // Set branches on the node (always 2+ branches)
          node.branches = [originalBranch, newBranch];
        } else {
          // Node already has branches, just add a new one with phase inheritance
          const defaultPhases = createDefaultPhases();
          const parentPhaseIndex = defaultPhases.findIndex((p) => p.name === node.name);

          let newBranchNodes: PhaseNode[] = [];
          if (parentPhaseIndex !== -1) {
            // Copy the parent phase and all phases after it from defaults
            newBranchNodes = defaultPhases.slice(parentPhaseIndex).map((phase) => ({
              ...JSON.parse(JSON.stringify(phase)),
              id: uid('n'),
              notes: [],
              events: [],
            }));
          }

          const newBranch: Branch = {
            id: uid('b'),
            name: branchName.trim(),
            nodes: newBranchNodes,
          };
          node.branches.push(newBranch);
        }

        return true;
      }
    );

    if (found) {
      await updateSeason(year, updatedSeason);
    }
  };

  // Delete a branch from a phase
  const deleteBranch = async (
    year: number,
    parentNodeId: string,
    branchId: string
  ) => {
    if (!currentProject) return;
    const season = seasons[year];
    if (!season) return;

    const updatedSeason = JSON.parse(JSON.stringify(season));

    const found = findAndUpdateNode(
      updatedSeason.root,
      parentNodeId,
      (node, parentNodes, nodeIndex) => {
        if (!node.branches) return false;

        const branchIndex = node.branches.findIndex((b: Branch) => b.id === branchId);
        if (branchIndex === -1) return false;

        // Remove the branch
        node.branches.splice(branchIndex, 1);

        // If only one branch remains, collapse back to parent
        if (node.branches.length === 1) {
          const remaining = node.branches[0];
          // Splice the remaining branch's nodes back after this node
          parentNodes.splice(nodeIndex + 1, 0, ...remaining.nodes);
          node.branches = null;
        }

        return true;
      }
    );

    if (found) {
      await updateSeason(year, updatedSeason);
    }
  };

  const deleteSeason = async (year: number) => {
    if (!currentProject) return;
    
    // Delete season document
    await deleteDoc(doc(db, 'seasons', `${currentProject.id}_${year}`));
    
    // Delete associated inventory
    await deleteDoc(doc(db, 'inventory', `${currentProject.id}_${year}`));
    
    // Update local state
    setAllSeasons((prev) => {
      const projectSeasons = { ...(prev[currentProject.id] || {}) };
      delete projectSeasons[year];
      return { ...prev, [currentProject.id]: projectSeasons };
    });
    
    setAllInventory((prev) => {
      const projectInventory = { ...(prev[currentProject.id] || {}) };
      delete projectInventory[year];
      return { ...prev, [currentProject.id]: projectInventory };
    });
    
    // Switch to another season if available
    const remainingYears = Object.keys(seasons)
      .map(Number)
      .filter((y) => y !== year);
    
    if (remainingYears.length > 0) {
      // Switch to the newest year
      const newestYear = Math.max(...remainingYears);
      updateAppState({ year: newestYear });
    } else {
      // No seasons left - stay on current year (empty state)
      // The UI will show "No season exists" message
    }
  };

  const updateInventory = async (year: number, inv: Inventory) => {
    if (!currentProject) return;
    await setDoc(doc(db, 'inventory', `${currentProject.id}_${year}`), {
      projectId: currentProject.id,
      sections: inv.sections,
    });
  };

  const updateLibrary = async (lib: Library) => {
    if (!currentProject) return;
    await setDoc(doc(db, 'library', currentProject.id), lib);
  };

  const updateAppState = (state: Partial<AppState>) => {
    setAppState((prev) => ({ ...prev, ...state }));
  };

  const inviteMembers = async (emails: string[]) => {
    if (!currentProject) return;
    // TODO: Send email invitations
    // For now, this is a placeholder
    console.log('Invite members:', emails);
  };

  const removeMember = async (memberId: string) => {
    if (!currentProject) return;
    const projectRef = doc(db, 'projects', currentProject.id);
    const projectDoc = await getDoc(projectRef);
    if (!projectDoc.exists()) return;

    const currentMembers = projectDoc.data().members || [];
    const updatedMembers = currentMembers.filter((id: string) => id !== memberId);

    await updateDoc(projectRef, {
      members: updatedMembers,
    });

    await loadMembers(currentProject.id);
  };

  const value = {
    currentProject,
    projects,
    allSeasons,
    allInventory,
    allLibrary,
    seasons,
    inventory,
    library,
    appState,
    members,
    loading,
    focusedBranchId,
    setFocusedBranchId,
    createProject,
    selectProject,
    createSeason,
    deleteSeason,
    updateSeason,
    addPhase,
    updatePhase,
    deletePhase,
    addBranch,
    deleteBranch,
    updateInventory,
    updateLibrary,
    updateAppState,
    inviteMembers,
    removeMember,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
