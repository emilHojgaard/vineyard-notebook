// Core data types based on design/BUILD-NOTES.md §3

export type SeasonStatus = 'current' | 'completed';
export type PhaseStatus = 'upcoming' | 'active' | 'done';
export type InventoryStatus = 'need' | 'partial' | 'have';
export type LibraryItemType = 'pdf' | 'video' | 'photo' | 'note';

export interface Note {
  id: string;
  author: string;
  text: string;
  date: string; // ISO date
  photo?: string; // URL or data URI
}

export interface Event {
  id: string;
  name: string;
  date: string; // ISO date
}

export interface Branch {
  id: string;
  name: string;
  nodes: Node[];
}

export interface Node {
  id: string;
  name: string;
  start: string; // ISO date or empty string
  end: string; // ISO date or empty string
  status: PhaseStatus;
  notes: Note[];
  events: Event[];
  invIds: string[]; // references to inventory items
  libIds: string[]; // references to library items
  branches: Branch[] | null; // null or array with 2+ items
}

export interface Season {
  status: SeasonStatus;
  title: string;
  root: Node[]; // trunk phases
  /** Server-visible structural lock; defaults to true for legacy seasons. */
  locked?: boolean;
  /** Firestore optimistic-concurrency revision; not shown in the UI. */
  revision?: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  haveQty: number;
  neededQty: number;
  unit: string;
  price: number | null;
}

export interface InventorySection {
  id: string;
  name: string;
  items: InventoryItem[];
}

export interface Inventory {
  sections: InventorySection[];
  /** Firestore optimistic-concurrency revision; not shown in the UI. */
  revision?: number;
}

export interface LibraryItem {
  id: string;
  title: string;
  type: LibraryItemType;
  content: string;
  image?: string; // URL or data URI
}

export interface LibrarySection {
  id: string;
  name: string;
  items: LibraryItem[];
}

export interface Library {
  sections: LibrarySection[];
  /** Firestore optimistic-concurrency revision; not shown in the UI. */
  revision?: number;
}

// App state (UI state, not persisted per-season)
export interface AppState {
  year: number;
  tab: 'timeline' | 'tree' | 'calendar' | 'inventory' | 'library';
  branchSelection: Record<string, string>; // nodeId -> branchId
  invFilter: string;
  calMonth: string | null; // YYYY-MM or null for current month
  locked: boolean;
  alertDays: number;
  eventAlertDays: number;
  treeFocus: string | null; // branch id
  focusedNodeId: string | null; // node to focus when navigating to timeline/tree
}

// Project & User types for Firebase
export interface Project {
  id: string;
  name: string;
  members: string[]; // user IDs
  owners?: string[]; // user IDs; createdBy remains the original owner for compatibility
  createdBy: string; // original owner user ID
  createdAt: Date;
  // Optional for backwards compatibility with projects created before membership ages were stored.
  memberAddedAt?: Record<string, Date>;
}

export interface User {
  id: string;
  email: string;
  displayName: string;
}

export interface Member {
  id: string;
  email: string;
  displayName: string;
  role: 'owner' | 'member';
  addedAt?: Date;
}

export interface Invitation {
  id: string;
  projectId: string;
  email: string;
  invitedBy: string; // user ID
  createdAt: string; // ISO date
  status: 'pending' | 'accepted';
}
