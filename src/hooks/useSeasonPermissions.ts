import { useData } from '../contexts/DataContext';

/** Shared edit policy for the selected season. */
export function useSeasonPermissions() {
  const { seasons, appState } = useData();
  const season = seasons[appState.year];
  const isArchived = season?.status !== 'current';
  const isLocked = appState.locked;

  return {
    season,
    isArchived,
    isLocked,
    canEditContent: Boolean(season) && !isArchived,
    canEditStructure: Boolean(season) && !isArchived && !isLocked,
  };
}
