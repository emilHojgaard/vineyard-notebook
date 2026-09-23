import { useData } from '../../contexts/DataContext';
import type { Node } from '../../types';
import { fmtRange, derivedStatus } from '../../lib/utils';
import { Icon } from '../../components/Icon';

export function TimelineView() {
  const { seasons, appState } = useData();
  const season = seasons[appState.year];

  if (!season) {
    return (
      <div className="p-4 text-center text-ink-soft">
        <p className="mb-4">No season data for {appState.year}</p>
        <p className="text-sm">Create phases to get started</p>
      </div>
    );
  }

  return (
    <div className="pb-20">
      {/* Vintage bar */}
      <div className="bg-surface px-4 py-3 border-b border-border">
        <div className="flex items-center justify-center gap-3 mb-2">
          <label className="text-xs uppercase tracking-wider text-ink-soft">
            Season
          </label>
          <select
            value={appState.year}
            className="px-3 py-1.5 bg-parchment-2 text-ink border border-border rounded-md text-sm font-semibold cursor-pointer"
          >
            <option value={appState.year}>{appState.year}</option>
          </select>
        </div>
        {season.status !== 'current' && (
          <div className="text-xs text-center text-ink-soft bg-surface-2 border border-border rounded-md py-1.5 px-2 flex items-center justify-center gap-2">
            <Icon name="lock" size={11} />
            <span>Archived season (read-only)</span>
          </div>
        )}
      </div>

      {/* Phase list */}
      <div className="p-4">
        {season.root.length === 0 ? (
          <div className="text-center py-8 text-ink-faint">
            <p className="mb-2">No phases yet</p>
            <button className="text-burgundy font-semibold hover:underline">
              + Add first phase
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {season.root.map((node, index) => (
              <PhaseCard
                key={node.id}
                node={node}
                isFirst={index === 0}
                isLast={index === season.root.length - 1}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface PhaseCardProps {
  node: Node;
  isFirst: boolean;
  isLast: boolean;
}

function PhaseCard({ node, isFirst, isLast }: PhaseCardProps) {
  const status = node.start && node.end ? derivedStatus(node) : node.status;
  
  const statusConfig = {
    upcoming: { color: 'text-st-upcoming', icon: null, label: 'Upcoming' },
    active: { color: 'text-st-active', icon: 'dot', label: 'Active' },
    done: { color: 'text-st-done', icon: 'check', label: 'Done' },
  } as const;

  const config = statusConfig[status];

  return (
    <div className="flex gap-2">
      {/* Timeline rail */}
      <div className="w-4 relative flex-shrink-0">
        <div
          className={`absolute left-1/2 -translate-x-px w-0.5 bg-paper-line ${
            isFirst ? 'top-5' : 'top-0'
          } ${isLast ? 'h-5' : 'bottom-0'}`}
        />
        <div className="absolute left-1/2 top-5 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-barrel shadow-[0_0_0_3px_var(--parchment)] z-10" />
      </div>

      {/* Card */}
      <div className="flex-1 pb-2">
        <button
          className={`w-full bg-surface border border-border rounded-lg p-3 text-left hover:bg-surface-2 transition-colors ${
            status === 'done' ? 'opacity-60' : ''
          }`}
        >
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm text-ink leading-snug">
                {node.name}
              </div>
              <div className="text-xs text-ink-soft mt-0.5">
                {fmtRange(node.start, node.end)}
              </div>
              {node.notes.length > 0 && (
                <div className="text-xs text-ink-faint mt-1">
                  {node.notes.length} note{node.notes.length !== 1 ? 's' : ''}
                </div>
              )}
            </div>
            <div className={`flex items-center gap-1 text-xs font-semibold ${config.color} flex-shrink-0`}>
              {config.icon && <Icon name={config.icon} size={12} />}
              <span>{config.label}</span>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
