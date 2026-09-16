import { useState, useEffect, useRef } from 'react';
import { useData } from '../contexts/DataContext';
import { Icon } from './Icon';
import { ConfirmDialog } from './ConfirmDialog';

interface SeasonSelectorProps {
  showAddButton?: boolean; // Whether to show the "+" button (based on edit mode)
}

export function SeasonSelector({ showAddButton = false }: SeasonSelectorProps) {
  const { seasons, appState, updateAppState, createSeason, deleteSeason } = useData();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [confirmDeleteSeason, setConfirmDeleteSeason] = useState<number | null>(null);
  const [hideOnScroll, setHideOnScroll] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);
  const selectorRef = useRef<HTMLDivElement>(null);

  // Get sorted year list (newest first)
  const sortedYears = Object.keys(seasons)
    .map(Number)
    .sort((a, b) => b - a);

  // Generate year options for the picker (current year ± 5 years)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i).reverse();

  const handleYearChange = (year: number) => {
    updateAppState({ year });
    setIsExpanded(false);
  };

  const handleAddSeasonClick = () => {
    setIsCreating(true);
  };

  const handleCreateSeason = async () => {
    // Check if season already exists
    if (seasons[selectedYear]) {
      setShowDuplicateConfirm(true);
      return;
    }

    await doCreateSeason();
  };

  const doCreateSeason = async () => {
    setCreating(true);
    try {
      await createSeason(selectedYear);
      updateAppState({ year: selectedYear });
      setIsCreating(false);
      setShowDuplicateConfirm(false);
      setIsExpanded(false); // Auto-collapse after creation
    } catch (error) {
      console.error('Failed to create season:', error);
      alert('Failed to create season. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteSeason = async () => {
    if (confirmDeleteSeason === null) return;
    try {
      await deleteSeason(confirmDeleteSeason);
      setConfirmDeleteSeason(null);
      setIsExpanded(false); // Auto-collapse after deletion
    } catch (error) {
      console.error('Failed to delete season:', error);
      alert('Failed to delete season. Please try again.');
    }
  };

  // Get sorted year list (newest first)
  const hasSeasons = sortedYears.length > 0;

  // Scroll detection to hide season selector (but not when expanded)
  useEffect(() => {
    const contentDiv = document.getElementById('app-content');
    if (!contentDiv) return;

    const handleScroll = () => {
      // Don't hide if the list is expanded
      if (isExpanded) {
        setHideOnScroll(false);
        return;
      }

      const currentScrollY = contentDiv.scrollTop;
      // Hide when scrolling down, show when scrolling up
      if (currentScrollY > lastScrollY && currentScrollY > 20) {
        setHideOnScroll(true);
      } else if (currentScrollY < lastScrollY) {
        setHideOnScroll(false);
      }
      setLastScrollY(currentScrollY);
    };

    contentDiv.addEventListener('scroll', handleScroll, { passive: true });
    return () => contentDiv.removeEventListener('scroll', handleScroll);
  }, [lastScrollY, isExpanded]);

  // Auto-close expanded list when scrolled out of view
  useEffect(() => {
    if (!isExpanded || !selectorRef.current) return;

    const contentDiv = document.getElementById('app-content');
    if (!contentDiv) return;

    // Use IntersectionObserver to detect when selector is out of view
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // If the selector is less than 50% visible, close the dropdown
          if (entry.intersectionRatio < 0.5) {
            setIsExpanded(false);
          }
        });
      },
      {
        root: contentDiv,
        threshold: [0.5], // Trigger when 50% visible/hidden
      }
    );

    observer.observe(selectorRef.current);

    return () => observer.disconnect();
  }, [isExpanded]);

  return (
    <>
      <div 
        ref={selectorRef}
        className="bg-surface px-4 py-2 border-b border-border transition-all duration-300"
        style={{
          backgroundColor: 'rgba(147, 118, 95, 0.06)',
          transform: hideOnScroll ? 'translateY(-100%)' : 'translateY(0)',
          opacity: hideOnScroll ? 0 : 1,
          maxHeight: hideOnScroll ? '0' : '500px',
          overflow: 'hidden',
        }}
      >
        {hasSeasons ? (
          <>
            {/* Season selector button */}
            <div className="flex items-center justify-center gap-2">
              <label className="text-xs uppercase tracking-wider text-ink-soft">Season</label>
              <button
                onClick={() => {
                  setIsExpanded(!isExpanded);
                  setHideOnScroll(false); // Ensure it's visible when expanding
                }}
                className="px-3 py-1.5 bg-parchment-2 text-ink border border-border rounded-md text-sm font-semibold cursor-pointer hover:bg-surface-2 transition-colors flex items-center gap-2"
              >
                <span>{appState.year}</span>
                <Icon name={isExpanded ? 'chevronUp' : 'chevronDown'} size={12} />
              </button>
            </div>

            {/* Expanded season list */}
            {isExpanded && (
              <div className="mt-2 bg-surface-2 border border-border rounded-md overflow-hidden">
                {/* Season list */}
                <div className="max-h-48 overflow-y-auto">
                  {sortedYears.map((year) => (
                    <div
                      key={year}
                      className={`flex items-center justify-between px-3 py-2 text-sm font-semibold transition-colors ${
                        year === appState.year
                          ? 'bg-burgundy/10 text-burgundy'
                          : 'text-ink hover:bg-surface'
                      }`}
                    >
                      <button
                        onClick={() => handleYearChange(year)}
                        className="flex-1 text-left"
                      >
                        {year}
                        {seasons[year]?.status !== 'current' && (
                          <span className="ml-2 text-xs text-ink-faint">(Archived)</span>
                        )}
                      </button>
                      {showAddButton && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteSeason(year);
                          }}
                          className="w-6 h-6 rounded-md flex items-center justify-center text-ink-soft hover:text-status-need hover:bg-status-need/10 transition-colors"
                          title="Delete season"
                        >
                          <Icon name="trash" size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Add Season button (only shown when edit mode is ON) */}
                {showAddButton && (
                  <button
                    onClick={handleAddSeasonClick}
                    className="w-full px-3 py-2 border-t border-border text-sm font-semibold text-burgundy hover:bg-surface transition-colors flex items-center justify-center gap-2"
                  >
                    <Icon name="plus" size={14} />
                    <span>Add Season</span>
                  </button>
                )}
              </div>
            )}

            {/* Archived indicator */}
            {seasons[appState.year]?.status !== 'current' && (
              <div className="text-xs text-center text-ink-soft bg-surface-2 border border-border rounded-md py-1 px-2 flex items-center justify-center gap-1.5 mt-2">
                <Icon name="lock" size={11} />
                <span>Archived season (read-only)</span>
              </div>
            )}
          </>
        ) : (
          /* Empty state - no seasons exist */
          <div className="text-center">
            <button
              onClick={handleAddSeasonClick}
              className="w-full px-4 py-2 bg-burgundy text-white font-semibold rounded-md text-sm hover:bg-burgundy-deep transition-colors flex items-center justify-center gap-2"
            >
              <Icon name="plus" size={14} />
              <span>Create Season</span>
            </button>
          </div>
        )}
      </div>

      {/* Create season modal */}
      {isCreating && (
        <div className="fixed inset-0 bg-cellar/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-parchment rounded-xl shadow-2xl w-full max-w-sm p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-ink">Add New Season</h3>
              <button
                onClick={() => {
                  setIsCreating(false);
                  setSelectedYear(new Date().getFullYear());
                }}
                className="w-7 h-7 rounded-full bg-surface border border-border flex items-center justify-center hover:bg-surface-2"
              >
                <Icon name="x" size={14} />
              </button>
            </div>

            <div className="mb-4">
              <label className="text-xs uppercase tracking-wider text-ink-faint block mb-2">
                Select Year
              </label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="w-full px-3 py-2 border border-border rounded-md bg-surface text-ink text-sm font-semibold"
                autoFocus
              >
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                    {seasons[year] ? ' (Already exists)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleCreateSeason}
                disabled={creating}
                className="flex-1 px-3 py-2 bg-burgundy text-white rounded-md text-sm font-semibold hover:bg-burgundy-deep transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? 'Creating...' : 'Create Season'}
              </button>
              <button
                onClick={() => {
                  setIsCreating(false);
                  setSelectedYear(new Date().getFullYear());
                }}
                disabled={creating}
                className="flex-1 px-3 py-2 bg-surface border border-border text-ink rounded-md text-sm font-semibold hover:bg-surface-2 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>

            <p className="text-xs text-ink-faint mt-3 text-center">
              New seasons include 7 default winemaking phases
            </p>
          </div>
        </div>
      )}

      {/* Duplicate season confirmation */}
      <ConfirmDialog
        isOpen={showDuplicateConfirm}
        title="Season Already Exists"
        message={`A season for ${selectedYear} already exists. Are you sure you want to create another?`}
        confirmText="Create Anyway"
        onConfirm={doCreateSeason}
        onCancel={() => {
          setShowDuplicateConfirm(false);
          setSelectedYear(new Date().getFullYear());
        }}
        isDanger={false}
      />

      {/* Delete season confirmation */}
      <ConfirmDialog
        isOpen={confirmDeleteSeason !== null}
        title="Delete Season"
        message={`Are you sure you want to delete season ${confirmDeleteSeason}? All phases, notes, and inventory for this season will be permanently removed.`}
        confirmText="Delete Season"
        onConfirm={handleDeleteSeason}
        onCancel={() => setConfirmDeleteSeason(null)}
        isDanger
      />
    </>
  );
}
