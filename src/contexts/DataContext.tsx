import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import type {
  Project,
  Season,
  Inventory,
  Library,
  AppState,
  Member,
  Invitation,
  Node as PhaseNode,
  Branch,
} from '../types';
import { syncStatuses, createDefaultPhases, uid, getSeasonCompletionBlockReason, findNodeById } from '../lib/utils';
import { hasBranchId, validateTree } from '../lib/tree';
import { addBranchToTree, deleteBranchFromTree, deleteNodeFromTree } from '../lib/tree-operations';
import {
  createInvitation,
  deleteInvitation,
  ensureUserProfile,
  subscribeProjectInvitations,
} from '../lib/repositories/auth-repository';
import {
  createProject as createProjectInRepository,
  loadMembers,
  promoteMemberToOwner as promoteMemberToOwnerInRepository,
  removeMember as removeMemberInRepository,
  subscribeProjects,
} from '../lib/repositories/projects-repository';
import { deleteSeason as deleteSeasonInRepository, saveSeason, subscribeSeasons } from '../lib/repositories/seasons-repository';
import { defaultInventory, deleteInventory, saveInventory, subscribeInventory } from '../lib/repositories/inventory-repository';
import { saveLibrary, subscribeLibrary } from '../lib/repositories/library-repository';
import {
  generateCalendarToken as generateCalendarTokenInRepository,
  listCalendarTokens as listCalendarTokensInRepository,
  revokeCalendarToken as revokeCalendarTokenInRepository,
} from '../lib/repositories/calendar-repository';
import { statusForError, type ConnectionStatus } from '../lib/connection-status';

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
  pendingInvitations: Invitation[] | null;
  loading: boolean;
  dataLoading: boolean;
  dataError: string | null;
  connectionStatus: ConnectionStatus;
  retryData: () => void;
  focusedBranchId: string | null;
  setFocusedBranchId: (branchId: string | null) => void;
  createProject: (name: string) => Promise<string>;
  selectProject: (projectId: string) => void;
  createSeason: (year: number) => Promise<void>;
  completeSeason: (year: number) => Promise<void>;
  deleteSeason: (year: number) => Promise<void>;
  updateSeason: (year: number, season: Season) => Promise<void>;
  addPhase: (year: number, name: string, options?: { parentNodeId?: string; branchId?: string; afterNodeId?: string }) => Promise<void>;
  updatePhase: (year: number, phaseId: string, updates: Partial<PhaseNode>) => Promise<void>;
  deletePhase: (year: number, phaseId: string) => Promise<void>;
  addBranch: (year: number, parentNodeId: string, branchName: string) => Promise<void>;
  deleteBranch: (year: number, parentNodeId: string, branchId: string) => Promise<void>;
  undoLastDeletion: () => Promise<boolean>;
  updateInventory: (year: number, inventory: Inventory) => Promise<void>;
  updateLibrary: (library: Library) => Promise<void>;
  updateAppState: (state: Partial<AppState>) => void;
  inviteMember: (email: string) => Promise<void>;
  removeMember: (memberId: string) => Promise<void>;
  promoteMemberToOwner: (memberId: string) => Promise<void>;
  cancelInvitation: (invitationId: string) => Promise<void>;
  generateCalendarToken: () => Promise<string>;
  revokeCalendarToken: (token: string) => Promise<void>;
  listCalendarTokens: () => Promise<Array<{ id: string; createdAt: string | null }>>;
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
  const [pendingInvitations, setPendingInvitations] = useState<Invitation[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
    typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'online',
  );
  const [dataRetryKey, setDataRetryKey] = useState(0);
  const [focusedBranchId, setFocusedBranchId] = useState<string | null>(null);
  const [lastDeletion, setLastDeletionState] = useState<{
    projectId: string;
    year: number;
    before: Season;
    after: Season;
  } | null>(null);
  const lastDeletionRef = useRef(lastDeletion);
  const setLastDeletion = (value: typeof lastDeletion) => {
    lastDeletionRef.current = value;
    setLastDeletionState(value);
  };

  const retryData = () => {
    setDataError(null);
    setDataLoading(true);
    setConnectionStatus(typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'reconnecting');
    setDataRetryKey((key) => key + 1);
  };

  const handleDataError = (error: unknown) => {
    const message = error instanceof Error ? error.message : 'Unable to load project data.';
    setDataError(message);
    setDataLoading(false);
    setConnectionStatus(statusForError(error, typeof navigator === 'undefined' || navigator.onLine));
  };

  const markDataLoaded = (loadedCollections: Set<string>, collectionName: string) => {
    loadedCollections.add(collectionName);
    if (loadedCollections.size === 3) {
      setDataLoading(false);
      setDataError(null);
      setConnectionStatus('online');
    }
  };

  useEffect(() => {
    const handleOffline = () => setConnectionStatus('offline');
    const handleOnline = () => {
      setConnectionStatus('reconnecting');
      setDataRetryKey((key) => key + 1);
    };
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  // Computed values for current project (for backward compatibility with existing views)
  const seasons = currentProject ? (allSeasons[currentProject.id] || {}) : {};
  const inventory = currentProject ? (allInventory[currentProject.id] || {}) : {};
  const library = currentProject ? (allLibrary[currentProject.id] || null) : null;
  // Undo actions can outlive the render that created their notification.
  const seasonsRef = useRef(seasons);
  const currentProjectRef = useRef(currentProject);
  seasonsRef.current = seasons;
  currentProjectRef.current = currentProject;

  // Default app state
  const [appState, setAppState] = useState<AppState>({
    year: new Date().getFullYear(),
    tab: 'timeline',
    branchSelection: {},
    invFilter: 'all',
    calMonth: null,
    locked: true,
    alertDays: 14,
    eventAlertDays: 7,
    treeFocus: null,
    focusedNodeId: null,
  });

  // Start each authenticated session in view-only mode. This effect only runs
  // when authentication changes, so project/season changes and ordinary renders
  // preserve an explicit edit-mode toggle made during the current session.
  useEffect(() => {
    setAppState((prev) => (prev.locked ? prev : { ...prev, locked: true }));
  }, [currentUser?.uid]);

  // Load user's projects
  useEffect(() => {
    if (!currentUser) {
      setProjects([]);
      setCurrentProject(null);
      setDataLoading(false);
      setDataError(null);
      setLoading(false);
      return;
    }

    return subscribeProjects(currentUser.uid, (loadedProjects) => {
      setProjects(loadedProjects);
      // Auto-select the first project if none is selected, and keep the selected
      // project current when ownership or membership changes remotely.
      setCurrentProject((selectedProject) => {
        if (selectedProject) {
          return loadedProjects.find((project) => project.id === selectedProject.id) || null;
        }
        return loadedProjects[0] || null;
      });
      setLoading(false);
    }, (error) => {
      setLoading(false);
      handleDataError(error);
    });
  }, [currentUser]);

  // Auto-adjust year when switching projects
  useEffect(() => {
    if (!currentProject) return;

    // Get available years for this project (using the scoped accessor)
    const availableYears = Object.keys(seasons).map(Number);

    // If no seasons yet, wait for them to load
    if (availableYears.length === 0) return;

    // If current year doesn't exist in this project, switch to newest season
    if (!seasons[appState.year]) {
      const newestYear = Math.max(...availableYears);
      setAppState((prev) => ({ ...prev, year: newestYear, calMonth: null }));
    }
  }, [currentProject, seasons, appState.year]);

  // Keep the local control in sync with the server-visible lock when changing
  // seasons/projects or receiving a newer revision. The revision dependency
  // avoids undoing an optimistic toggle before its write is confirmed.
  const selectedSeason = seasons[appState.year];
  useEffect(() => {
    if (selectedSeason?.locked !== undefined) {
      setAppState((prev) => prev.locked === selectedSeason.locked
        ? prev
        : { ...prev, locked: selectedSeason.locked! });
    }
  }, [currentProject?.id, appState.year, selectedSeason?.revision, selectedSeason?.locked]);

  // Branch focus belongs to one season/project and must not leak into another.
  useEffect(() => {
    setFocusedBranchId(null);
    setLastDeletion(null);
  }, [currentProject?.id, appState.year]);

  // Load project data when project changes
  useEffect(() => {
    if (!currentProject) {
      setDataLoading(false);
      return;
    }

    setDataLoading(true);
    setDataError(null);
    const loadedCollections = new Set<string>();
    const unsubscribers: (() => void)[] = [];

    // Load seasons
    unsubscribers.push(subscribeSeasons(currentProject.id, (loadedSeasons) => {
      Object.values(loadedSeasons).forEach((season) => syncStatuses(season.root));
      setAllSeasons((prev) => ({ ...prev, [currentProject.id]: loadedSeasons }));
      markDataLoaded(loadedCollections, 'seasons');
    }, (error) => handleDataError(error)));

    // Load inventory
    unsubscribers.push(subscribeInventory(currentProject.id, (loadedInventory) => {
      setAllInventory((prev) => ({ ...prev, [currentProject.id]: loadedInventory }));
      markDataLoaded(loadedCollections, 'inventory');
    }, (error) => handleDataError(error)));

    // Load library (project-wide, not per-year)
    unsubscribers.push(subscribeLibrary(currentProject.id, (lib) => {
      setAllLibrary((prev) => ({ ...prev, [currentProject.id]: lib }));
      markDataLoaded(loadedCollections, 'library');
    }, (error) => handleDataError(error)));

    // Load pending invitations
    unsubscribers.push(subscribeProjectInvitations(currentProject.id, (invites) => {
      setPendingInvitations(invites as Invitation[]);
    }));

    // Load members
    void loadMembers(currentProject.id);

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [currentProject, dataRetryKey]);

  const refreshMembers = async (projectId: string) => {
    setMembers(await loadMembers(projectId));
  };

  const createProject = async (name: string): Promise<string> => {
    if (!currentUser) throw new Error('Must be logged in');

    const projectId = `proj_${Date.now()}`;
    const year = new Date().getFullYear();
    // Profile creation remains separate so an existing profile is never overwritten.
    await ensureUserProfile({
      uid: currentUser.uid,
      email: currentUser.email,
      displayName: currentUser.displayName,
    });
    const initialSeason: Season = {
      status: 'current',
      title: `${year}`,
      root: createDefaultPhases(),
      locked: true,
    };
    syncStatuses(initialSeason.root);
    await createProjectInRepository({
      id: projectId,
      name,
      ownerId: currentUser.uid,
      season: initialSeason,
      inventory: defaultInventory(),
      library: { sections: [] },
    });

    // Immediately set as current project (don't wait for snapshot)
    const newProject: Project = {
      id: projectId,
      name,
      members: [currentUser.uid],
      createdBy: currentUser.uid,
      createdAt: new Date(),
      memberAddedAt: {
        [currentUser.uid]: new Date(),
      },
    };
    setCurrentProject(newProject);

    return projectId;
  };

  const selectProject = (projectId: string) => {
    const project = projects.find((p) => p.id === projectId);
    if (project) {
      setCurrentProject(project);
      setLastDeletion(null);
      setFocusedBranchId(null);
      setAppState((prev) => ({ ...prev, calMonth: null }));
    }
  };

  const createSeason = async (year: number) => {
    if (!currentProject) throw new Error('No project selected');
    
    const initialSeason: Season = {
      status: 'current',
      title: `${year}`,
      root: createDefaultPhases(),
      locked: true,
    };
    
    syncStatuses(initialSeason.root);
    
    await saveSeason(currentProject.id, year, initialSeason);
    // Create inventory with default sections for this year
    await saveInventory(currentProject.id, year, defaultInventory());
  };

  const updateSeason = async (year: number, season: Season) => {
    if (!currentProject) return;
    const validation = validateTree(season.root);
    if (!validation.valid) {
      throw new Error(`Cannot save invalid season tree: ${validation.errors.join('; ')}`);
    }
    syncStatuses(season.root);
    const savedSeason = await saveSeason(currentProject.id, year, season, season.revision);
    // Reflect a confirmed write immediately; the snapshot listener will still
    // reconcile remote edits as before. The revision is retained so a later
    // save rejects stale collaborative edits instead of overwriting them.
    setAllSeasons((prev) => ({
      ...prev,
      [currentProject.id]: {
        ...(prev[currentProject.id] || {}),
        [year]: savedSeason,
      },
    }));
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

  // Delete a phase from the tree. The pure operation is tested independently
  // so structural edits cannot silently discard branches.
  const deletePhase = async (year: number, phaseId: string) => {
    if (!currentProject) return;
    const season = seasons[year];
    if (!season) return;

    const before = JSON.parse(JSON.stringify(season)) as Season;
    const updatedSeason = JSON.parse(JSON.stringify(season)) as Season;
    deleteNodeFromTree(updatedSeason.root, phaseId);
    if (JSON.stringify(before) === JSON.stringify(updatedSeason)) return;

    await updateSeason(year, updatedSeason);
    setLastDeletion({
      projectId: currentProject.id,
      year,
      before,
      after: JSON.parse(JSON.stringify(updatedSeason)) as Season,
    });
    if (focusedBranchId && !hasBranchId(updatedSeason.root, focusedBranchId)) {
      setFocusedBranchId(null);
    }
  };

  // Add a new branch to a phase. Structural manipulation lives in a pure,
  // tested operation; this layer only prepares inherited phase data and saves.
  const addBranch = async (year: number, parentNodeId: string, branchName: string) => {
    if (!currentProject) return;
    const season = seasons[year];
    if (!season) return;

    const updatedSeason = JSON.parse(JSON.stringify(season));
    const parent = findNodeById(updatedSeason.root, parentNodeId);
    if (!parent) return;

    const defaultPhases = createDefaultPhases();
    const parentPhaseIndex = defaultPhases.findIndex((phase) => phase.name === parent.name);
    const newBranchNodes = parentPhaseIndex === -1
      ? []
      : defaultPhases.slice(parentPhaseIndex).map((phase) => ({
          ...JSON.parse(JSON.stringify(phase)),
          id: uid('n'),
          notes: [],
          events: [],
        }));

    addBranchToTree(updatedSeason.root, parentNodeId, {
      id: uid('b'),
      name: branchName.trim(),
      nodes: newBranchNodes,
    });
    await updateSeason(year, updatedSeason);
  };

  // Delete a branch and collapse a one-branch point through the tested tree operation.
  const deleteBranch = async (year: number, parentNodeId: string, branchId: string) => {
    if (!currentProject) return;
    const season = seasons[year];
    if (!season) return;

    const before = JSON.parse(JSON.stringify(season)) as Season;
    const updatedSeason = JSON.parse(JSON.stringify(season)) as Season;
    deleteBranchFromTree(updatedSeason.root, parentNodeId, branchId);
    if (JSON.stringify(before) === JSON.stringify(updatedSeason)) return;

    await updateSeason(year, updatedSeason);
    setLastDeletion({
      projectId: currentProject.id,
      year,
      before,
      after: JSON.parse(JSON.stringify(updatedSeason)) as Season,
    });
    if (focusedBranchId === branchId) setFocusedBranchId(null);
  };

  // Restore only when the season is still exactly the post-delete snapshot.
  // Any intervening edit or remote change makes restoration unsafe.
  const undoLastDeletion = async (): Promise<boolean> => {
    const deletion = lastDeletionRef.current;
    const project = currentProjectRef.current;
    if (!deletion || !project || deletion.projectId !== project.id) return false;
    const currentSeason = seasonsRef.current[deletion.year];
    if (!currentSeason || JSON.stringify(currentSeason) !== JSON.stringify(deletion.after)) {
      setLastDeletion(null);
      return false;
    }

    await updateSeason(deletion.year, deletion.before);
    setLastDeletion(null);
    return true;
  };

  const completeSeason = async (year: number) => {
    if (!currentProject) return;
    const season = seasons[year];
    if (!season || season.status !== 'current') return;
    const blockReason = getSeasonCompletionBlockReason(season);
    if (blockReason) throw new Error(blockReason);
    await updateSeason(year, { ...season, status: 'completed' });
  };

  const deleteSeason = async (year: number) => {
    if (!currentProject) return;
    
    // Delete inventory first: the rules intentionally require the live season
    // lock/status gate while the season document still exists.
    await deleteInventory(currentProject.id, year, inventory[year]?.revision);
    await deleteSeasonInRepository(currentProject.id, year, seasons[year]?.revision);
    
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
    const season = seasons[year];
    if (season && season.status !== 'current') {
      throw new Error('Archived season inventory is read-only');
    }
    const savedInventory = await saveInventory(currentProject.id, year, inv, inv.revision);
    setAllInventory((prev) => ({
      ...prev,
      [currentProject.id]: {
        ...(prev[currentProject.id] || {}),
        [year]: savedInventory,
      },
    }));
  };

  const updateLibrary = async (lib: Library) => {
    if (!currentProject) return;
    const savedLibrary = await saveLibrary(currentProject.id, lib, lib.revision);
    setAllLibrary((prev) => ({ ...prev, [currentProject.id]: savedLibrary }));
  };

  const updateAppState = (state: Partial<AppState>) => {
    setAppState((prev) => ({
      ...prev,
      ...state,
      ...(state.year !== undefined && state.year !== prev.year ? { calMonth: null } : {}),
    }));

    // The padlock is also persisted so Firestore can enforce the structural
    // boundary. Content edits remain possible while locked because season
    // storage separates structure from node content.
    if (state.locked !== undefined && currentProject) {
      const season = seasons[appState.year];
      if (season && season.status === 'current' && season.locked !== state.locked) {
        void updateSeason(appState.year, { ...season, locked: state.locked }).catch((error) => {
          handleDataError(error);
        });
      }
    }
  };

  const inviteMember = async (email: string) => {
    if (!currentProject || !currentUser) throw new Error('Not authenticated');

    await createInvitation(currentProject.id, email, currentUser.uid);
    
    // Real-time listener will automatically update pendingInvitations
  };

  const removeMember = async (memberId: string) => {
    if (!currentProject || !currentUser) return;

    const projectId = currentProject.id;
    await removeMemberInRepository(projectId, memberId, currentUser.uid);
    // Once an owner leaves, Firestore rules correctly revoke their access;
    // avoid a post-transaction read from the departing client.
    if (memberId !== currentUser.uid) await refreshMembers(projectId);
  };

  const promoteMemberToOwner = async (memberId: string) => {
    if (!currentProject || !currentUser) throw new Error('Not authenticated');
    await promoteMemberToOwnerInRepository(currentProject.id, memberId);
    await refreshMembers(currentProject.id);
  };

  const cancelInvitation = async (invitationId: string) => {
    await deleteInvitation(invitationId);
  };

  const generateCalendarToken = async (): Promise<string> => {
    if (!currentProject) throw new Error('No project selected');
    return generateCalendarTokenInRepository(currentProject.id);
  };

  const revokeCalendarToken = async (token: string): Promise<void> => {
    await revokeCalendarTokenInRepository(token);
  };

  const listCalendarTokens = async (): Promise<Array<{ id: string; createdAt: string | null }>> => {
    if (!currentProject) return [];
    return listCalendarTokensInRepository(currentProject.id);
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
    pendingInvitations,
    loading,
    dataLoading,
    dataError,
    connectionStatus,
    retryData,
    focusedBranchId,
    setFocusedBranchId,
    createProject,
    selectProject,
    createSeason,
    completeSeason,
    deleteSeason,
    updateSeason,
    addPhase,
    updatePhase,
    deletePhase,
    addBranch,
    deleteBranch,
    undoLastDeletion,
    updateInventory,
    updateLibrary,
    updateAppState,
    inviteMember,
    removeMember,
    promoteMemberToOwner,
    cancelInvitation,
    generateCalendarToken,
    revokeCalendarToken,
    listCalendarTokens,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
