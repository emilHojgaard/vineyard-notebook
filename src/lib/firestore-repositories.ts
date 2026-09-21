import { collection, doc } from 'firebase/firestore';
import { db } from './firebase';

// Centralized Firestore paths. Feature code should not construct collection IDs.
export const projectDocument = (projectId: string) => doc(db, 'projects', projectId);
export const seasonDocument = (projectId: string, year: number) => doc(db, 'seasons', `${projectId}_${year}`);
export const inventoryDocument = (projectId: string, year: number) => doc(db, 'inventory', `${projectId}_${year}`);
export const libraryDocument = (projectId: string) => doc(db, 'library', projectId);
export const invitationsCollection = () => collection(db, 'invitations');
