import { onSnapshot, setDoc } from 'firebase/firestore';
import type { Library } from '../../types';
import { db } from '../firebase';
import { libraryDocument } from '../firestore-repositories';

export function subscribeLibrary(
  projectId: string,
  onLibrary: (library: Library) => void,
  onError: (error: Error) => void,
): () => void {
  return onSnapshot(libraryDocument(projectId), (snapshot) => {
    onLibrary(snapshot.exists() ? snapshot.data() as Library : { sections: [] });
  }, onError);
}

export async function saveLibrary(projectId: string, library: Library): Promise<void> {
  await setDoc(libraryDocument(projectId), library);
}
