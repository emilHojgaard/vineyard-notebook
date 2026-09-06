import { useState } from 'react';
import { useData } from '../contexts/DataContext';
import { Icon } from './Icon';

export function SeasonSelector() {
  const { seasons, appState, updateAppState, createSeason } = useData();
  const [addingYear, setAddingYear] = useState(false);
  const [newYear, setNewYear] = useState('');
  const [creating, setCreating] = useState(false);

  const isEditMode = !appState.locked;
  const availableYears = Object.keys(seasons)
    .map(Number)
    .sort((a, b) => b - a); // Sort descending (newest first)

  const handleCreateSeason = async () => {
    const year = parseInt(newYear);
    if (!year || year < 2000 || year > 2100) {
      alert('Please enter a valid year between 2000 and 2100');
      return;
    }
    if (seasons[year]) {
      alert(`Season ${year} already exists`);
      return;
    }

    setCreating(true);
    try {
      await createSeason(year);
      updateAppState({ year });
      setNewYear('');
      setAddingYear(false);
    } catch (error) {
      console.error('Failed to create season:', error);
      alert('Failed to create season. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="bg-surface px-4 py-3 border-b border-border">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs uppercase tracking-wider text-ink-faint font-semibold">
          Season
        </div>
        {isEditMode && (
          <button
            onClick={() => setAddingYear(!addingYear)}
            className="text-xs font-semibold text-burgundy hover:underline flex items-center gap-1"
          >
            <Icon name="plus" size={10} />
            New Season
          </button>
        )}
      </div>

      {/* Season list */}
      <div className="flex flex-wrap gap-2">
        {availableYears.map((year) => (
          <button
            key={year}
            onClick={() => updateAppState({ year })}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
              appState.year === year
                ? 'bg-burgundy text-white'
                : 'bg-parchment border border-border text-ink hover:bg-surface'
            }`}
          >
            {year}
          </button>
        ))}
        {availableYears.length === 0 && !addingYear && (
          <div className="text-sm text-ink-soft">No seasons yet</div>
        )}
      </div>

      {/* Add new season */}
      {addingYear && (
        <div className="mt-3 flex gap-2">
          <input
            type="number"
            value={newYear}
            onChange={(e) => setNewYear(e.target.value)}
            placeholder="Year (e.g., 2024)"
            className="flex-1 px-3 py-1.5 border border-border rounded-lg bg-parchment text-ink text-sm"
            min="2000"
            max="2100"
            disabled={creating}
          />
          <button
            onClick={handleCreateSeason}
            disabled={creating || !newYear}
            className="px-3 py-1.5 bg-burgundy text-white text-sm font-semibold rounded-lg hover:bg-burgundy-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? '...' : 'Create'}
          </button>
          <button
            onClick={() => {
              setAddingYear(false);
              setNewYear('');
            }}
            disabled={creating}
            className="px-3 py-1.5 bg-surface border border-border text-ink text-sm font-semibold rounded-lg hover:bg-surface-2 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
