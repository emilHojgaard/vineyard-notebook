import { collection, deleteDoc, onSnapshot, query, setDoc, where } from 'firebase/firestore';
import type { Season } from '../../types';
import { db } from '../firebase';
import { seasonDocument } from '../firestore-repositories';

export function subscribeSeasons(
  projectId: string,
  onSeasons: (seasons: Record<number, Season>) => void,
  onError: (error: Error) => void,
): () => void {
  return onSnapshot(
    query(collection(db, 'seasons'), where('projectId', '==', projectId)),
    (snapshot) => {
      const seasons: Record<number, Season> = {};
      snapshot.docs.forEach((seasonDoc) => {
        const year = parseInt(seasonDoc.id.split('_')[2] || '0');
        if (year) seasons[year] = seasonDoc.data() as Season;
      });
      onSeasons(seasons);
    },
    onError,
  );
}

export async function saveSeason(projectId: string, year: number, season: Season): Promise<void> {
  await setDoc(seasonDocument(projectId, year), { ...season, projectId });
}

export async function deleteSeason(projectId: string, year: number): Promise<void> {
  await deleteDoc(seasonDocument(projectId, year));
}
