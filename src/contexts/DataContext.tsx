import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
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
} from '../types';
import { syncStatuses, createDefaultPhases } from '../lib/utils';

interface DataContextType {
  currentProject: Project | null;
  projects: Project[];
  seasons: Record<number, Season>;
  inventory: Record<number, Inventory>;
  library: Library | null;
  appState: AppState;
  members: Member[];
  loading: boolean;
  createProject: (name: string, initialSeasonTitle: string) => Promise<string>;
  selectProject: (projectId: string) => void;
  createSeason: (year: number) => Promise<void>;
  updateSeason: (year: number, season: Season) => Promise<void>;
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
  const [seasons, setSeasons] = useState<Record<number, Season>>({});
  const [inventory, setInventory] = useState<Record<number, Inventory>>({});
  const [library, setLibrary] = useState<Library | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

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
          const year = parseInt(doc.id.split('_')[1] || '0');
          if (year) {
            loadedSeasons[year] = data as Season;
            // Sync statuses on load
            syncStatuses(loadedSeasons[year].root);
          }
        });
        setSeasons(loadedSeasons);
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
          const year = parseInt(doc.id.split('_')[1] || '0');
          if (year) {
            loadedInventory[year] = { sections: data.sections || [] };
          }
        });
        setInventory(loadedInventory);
      })
    );

    // Load library (project-wide, not per-year)
    const libraryDoc = doc(db, 'library', currentProject.id);
    unsubscribers.push(
      onSnapshot(libraryDoc, (snapshot) => {
        if (snapshot.exists()) {
          setLibrary(snapshot.data() as Library);
        } else {
          setLibrary({ sections: [] });
        }
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

  const createProject = async (name: string, initialSeasonTitle: string): Promise<string> => {
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
      title: initialSeasonTitle,
      root: createDefaultPhases(),
    };
    
    // Sync statuses for the default phases
    syncStatuses(initialSeason.root);

    await setDoc(doc(db, 'seasons', `${projectId}_${year}`), {
      ...initialSeason,
      projectId,
    });

    // Create empty inventory
    await setDoc(doc(db, 'inventory', `${projectId}_${year}`), {
      projectId,
      sections: [],
    });

    // Create empty library
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

    return projectId;
  };

  const selectProject = (projectId: string) => {
    const project = projects.find((p) => p.id === projectId);
    if (project) {
      setCurrentProject(project);
    }
  };

  const createSeason = async (year: number) => {
    if (!currentProject) throw new Error('No project selected');
    
    const initialSeason: Season = {
      status: 'current',
      title: `${year} Vintage`,
      root: createDefaultPhases(),
    };
    
    syncStatuses(initialSeason.root);
    
    await setDoc(doc(db, 'seasons', `${currentProject.id}_${year}`), {
      ...initialSeason,
      projectId: currentProject.id,
    });
    
    // Create empty inventory for this year
    await setDoc(doc(db, 'inventory', `${currentProject.id}_${year}`), {
      projectId: currentProject.id,
      sections: [],
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
    seasons,
    inventory,
    library,
    appState,
    members,
    loading,
    createProject,
    selectProject,
    createSeason,
    updateSeason,
    updateInventory,
    updateLibrary,
    updateAppState,
    inviteMembers,
    removeMember,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
