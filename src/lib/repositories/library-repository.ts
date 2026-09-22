import { onSnapshot, runTransaction } from 'firebase/firestore';
import type { Library } from '../../types';
import { db } from '../firebase';
import { libraryDocument } from '../firestore-repositories';
import { ConcurrentWriteError } from './seasons-repository';

export function subscribeLibrary(
  projectId: string,
  onLibrary: (library: Library) => void,
  onError: (error: Error) => void,
): () => void {
  return onSnapshot(libraryDocument(projectId), (snapshot) => {
    const data = snapshot.exists() ? snapshot.data() : {};
    onLibrary(snapshot.exists()
      ? { sections: data.sections || [], revision: data.revision || 0 }
      : { sections: [], revision: 0 });
  }, onError);
}

export async function saveLibrary(
  projectId: string,
  library: Library,
  expectedRevision?: number,
): Promise<Library> {
  const ref = libraryDocument(projectId);
  let saved: Library;
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    const currentRevision = snapshot.exists() ? (snapshot.data().revision || 0) : 0;
    if (snapshot.exists() && expectedRevision !== currentRevision) {
      throw new ConcurrentWriteError('Library');
    }
    if (!snapshot.exists() && expectedRevision !== undefined) {
      throw new ConcurrentWriteError('Library');
    }
    saved = { sections: library.sections, revision: currentRevision + 1 };
    transaction.set(ref, { projectId, ...saved });
  });
  return saved!;
}
