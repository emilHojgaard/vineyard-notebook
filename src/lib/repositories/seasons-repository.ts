import { collection, onSnapshot, query, runTransaction, where } from 'firebase/firestore';
import type { Season } from '../../types';
import { db } from '../firebase';
import { seasonDocument } from '../firestore-repositories';
import { joinSeasonRoot, splitSeasonRoot, type SeasonContent, type SeasonStructureNode } from './season-storage';

export class ConcurrentWriteError extends Error {
  code = 'aborted';

  constructor(resource: string) {
    super(`${resource} changed remotely. Reload it before saving again.`);
    this.name = 'ConcurrentWriteError';
  }
}

function hydrateSeason(data: Record<string, unknown>): Season {
  const structure = data.structure as SeasonStructureNode[] | undefined;
  const content = data.content as SeasonContent | undefined;
  const root = structure && content
    ? joinSeasonRoot(structure, content)
    : (data.root as Season['root'] | undefined) || [];
  return {
    status: data.status as Season['status'],
    title: String(data.title),
    root,
    locked: data.locked as boolean | undefined ?? true,
    revision: data.revision as number | undefined || 0,
  };
}

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
        const data = seasonDoc.data();
        const year = Number(data.title) || parseInt(seasonDoc.id.split('_').pop() || '0', 10);
        if (year) seasons[year] = hydrateSeason(data);
      });
      onSeasons(seasons);
    },
    onError,
  );
}

/**
 * Save with an optimistic revision check. A stale collaborator can no longer
 * silently replace a newer tree; callers must reload and retry explicitly.
 * The structure/content split gives Firestore rules a server-visible way to
 * permit ordinary edits while rejecting structural edits on a locked season.
 */
export async function saveSeason(
  projectId: string,
  year: number,
  season: Season,
  expectedRevision?: number,
): Promise<Season> {
  const ref = seasonDocument(projectId, year);
  let saved: Season;
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    const current = snapshot.exists() ? snapshot.data() : {};
    const currentRevision = snapshot.exists() ? (current.revision || 0) : 0;
    if (snapshot.exists() && expectedRevision !== currentRevision) {
      throw new ConcurrentWriteError(`Season ${year}`);
    }
    if (!snapshot.exists() && expectedRevision !== undefined) {
      throw new ConcurrentWriteError(`Season ${year}`);
    }
    const { structure, content } = splitSeasonRoot(season.root);
    const nextRevision = currentRevision + 1;
    saved = { ...season, revision: nextRevision, locked: season.locked ?? current.locked ?? true };
    transaction.set(ref, {
      projectId,
      status: saved.status,
      title: saved.title,
      structure,
      content,
      locked: saved.locked,
      revision: nextRevision,
    });
  });
  return saved!;
}

export async function deleteSeason(projectId: string, year: number, expectedRevision?: number): Promise<void> {
  const ref = seasonDocument(projectId, year);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) return;
    const currentRevision = snapshot.data().revision || 0;
    if (expectedRevision !== currentRevision) throw new ConcurrentWriteError(`Season ${year}`);
    transaction.delete(ref);
  });
}
