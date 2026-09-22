import { useState } from 'react';
import { Modal } from '../../components/Modal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Icon } from '../../components/Icon';
import type { Node, Event } from '../../types';
import { fmtDate, uid } from '../../lib/utils';
import { useData } from '../../contexts/DataContext';
import { PhaseModal } from '../timeline/PhaseModal';

interface CalendarEvent {
  id: string;
  type: 'phase' | 'check';
  title: string;
  date: string;
  nodeId: string;
  color: string;
  checkName?: string;
}

interface DayEventsModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: string;
  events: CalendarEvent[];
  onUpdate: () => void;
  isArchived: boolean;
}

export function DayEventsModal({
  isOpen,
  onClose,
  date,
  events,
  onUpdate,
  isArchived,
}: DayEventsModalProps) {
  const { seasons, appState, updateSeason } = useData();
  const season = seasons[appState.year];

  const [confirmDeleteEvent, setConfirmDeleteEvent] = useState<{
    nodeId: string;
    eventId: string;
    eventName: string;
  } | null>(null);
  const [expandedPhase, setExpandedPhase] = useState<string | null>(null);
  const [newEventName, setNewEventName] = useState('');
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);
  const [phaseModalNodeId, setPhaseModalNodeId] = useState<string | null>(null);

  if (!season) return null;

  // Find a node by ID in the tree
  const findNode = (nodeId: string): Node | null => {
    let found: Node | null = null;

    const walk = (nodes: Node[]) => {
      for (const node of nodes) {
        if (node.id === nodeId) {
          found = node;
          return;
        }
        if (node.branches) {
          for (const branch of node.branches) {
            walk(branch.nodes);
            if (found) return;
          }
        }
      }
    };

    walk(season.root);
    return found;
  };

  const handleDeleteEvent = () => {
    if (!confirmDeleteEvent) return;

    const node = findNode(confirmDeleteEvent.nodeId);
    if (!node) return;

    const idx = node.events.findIndex((e) => e.id === confirmDeleteEvent.eventId);
    if (idx !== -1) {
      node.events.splice(idx, 1);
      updateSeason(appState.year, season);
      onUpdate();
    }
    setConfirmDeleteEvent(null);
  };

  const handleAddEvent = () => {
    if (!newEventName.trim() || !selectedPhaseId) return;

    const node = findNode(selectedPhaseId);
    if (!node) return;

    const newEvent: Event = {
      id: uid('event'),
      name: newEventName.trim(),
      date: date,
    };

    node.events.push(newEvent);
    setNewEventName('');
    setSelectedPhaseId(null);
    updateSeason(appState.year, season);
    onUpdate();
  };

  // Group events by phase
  const phaseEvents = events.filter((e) => e.type === 'phase');
  const checkEvents = events.filter((e) => e.type === 'check');

  // Collect all phases with their branch context
  const collectPhasesWithBranchContext = () => {
    const phases: Array<{
      id: string;
      name: string;
      displayName: string;
      color: string;
      node: Node | null;
    }> = [];

    const walk = (nodes: Node[], branchPath: string[]) => {
      nodes.forEach((node) => {
        // Build display name with branch context
        let displayName = node.name;
        if (branchPath.length > 0) {
          displayName = `${node.name} (${branchPath.join(' → ')})`;
        }

        phases.push({
          id: node.id,
          name: node.name,
          displayName,
          color: '#000', // Will be set by walkWithColor in CalendarView
          node,
        });

        // Walk branches
        if (node.branches) {
          node.branches.forEach((branch, idx) => {
            const newPath = [...branchPath, branch.name];
            walk(branch.nodes, newPath);
          });
        }
      });
    };

    walk(season.root, []);
    return phases;
  };

  const allPhases = collectPhasesWithBranchContext();
  const phaseModalNode = phaseModalNodeId ? findNode(phaseModalNodeId) : null;

  return (
    <>
      <Modal
        isOpen={isOpen && !phaseModalNode}
        onClose={onClose}
        title={fmtDate(date)}
        maxWidth="560px"
      >
        {events.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-sm text-ink-faint italic mb-6">
              No events on this day
            </div>
            {!isArchived && allPhases.length > 0 && (
              <div className="max-w-sm mx-auto">
                <h4 className="text-xs font-bold uppercase tracking-wider text-ink-faint mb-2 text-left">
                  Add a check for this day
                </h4>
                <div className="flex flex-col gap-2">
                  <select
                    value={selectedPhaseId || ''}
                    onChange={(e) => setSelectedPhaseId(e.target.value)}
                    className="px-3 py-2 border border-border rounded-md bg-surface text-ink text-sm"
                  >
                    <option value="">Select a phase...</option>
                    {allPhases.map((phase) => (
                      <option key={phase.id} value={phase.id}>
                        {phase.displayName}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newEventName}
                      onChange={(e) => setNewEventName(e.target.value)}
                      placeholder="e.g. pH check"
                      className="flex-1 px-3 py-2 border border-border rounded-md bg-surface text-ink text-sm"
                    />
                    <button
                      onClick={handleAddEvent}
                      disabled={!newEventName.trim() || !selectedPhaseId}
                      className="px-4 py-2 rounded-md bg-burgundy text-white hover:bg-burgundy-deep transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-sm"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Phase starts/ends */}
            {phaseEvents.length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-ink-faint mb-2">
                  Phase Milestones
                </h4>
                <div className="space-y-2">
                  {phaseEvents.map((event) => {
                    const node = findNode(event.nodeId);
                    const isStart = event.id.endsWith('-start');
                    const isExpanded = expandedPhase === event.nodeId;

                    return (
                      <div
                        key={event.id}
                        className="bg-surface border border-border rounded-md overflow-hidden"
                      >
                        <div className="flex items-stretch">
                          <button
                            onClick={() =>
                              setExpandedPhase(isExpanded ? null : event.nodeId)
                            }
                            className="flex-1 flex items-center gap-3 px-3 py-3 hover:bg-surface-2 transition-colors text-left"
                          >
                            <div
                              className="w-1 h-8 rounded-full flex-shrink-0"
                              style={{ backgroundColor: event.color }}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-ink">
                                {event.title}
                              </div>
                              <div className="text-xs text-ink-soft">
                                {isStart ? 'Phase starts' : 'Phase ends'}
                              </div>
                            </div>
                            <Icon
                              name={isExpanded ? 'chevronUp' : 'chevronDown'}
                              size={16}
                              className="text-ink-soft"
                            />
                          </button>
                          <button
                            onClick={() => setPhaseModalNodeId(event.nodeId)}
                            className="px-3 border-l border-border hover:bg-surface-2 transition-colors text-ink-soft hover:text-burgundy flex items-center"
                            title="Open phase details"
                          >
                            <Icon name="chevronright" size={14} />
                          </button>
                        </div>
                        {isExpanded && node && (
                          <div className="px-3 pb-3 space-y-3 border-t border-border bg-surface-2">
                            {/* Phase details */}
                            <div className="pt-3">
                              <div className="text-xs text-ink-faint mb-1">Duration</div>
                              <div className="text-sm text-ink">
                                {node.start && node.end
                                  ? `${fmtDate(node.start)} → ${fmtDate(node.end)}`
                                  : 'No dates set'}
                              </div>
                            </div>
                            {node.notes.length > 0 && (
                              <div>
                                <div className="text-xs text-ink-faint mb-1">
                                  Recent Notes ({node.notes.length})
                                </div>
                                <div className="text-sm text-ink-soft">
                                  {node.notes[node.notes.length - 1].text ||
                                    'Photo note'}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Checks/Events */}
            {checkEvents.length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-ink-faint mb-2">
                  Checks &amp; Events
                </h4>
                <div className="space-y-2">
                  {checkEvents.map((event) => {
                    const node = findNode(event.nodeId);
                    return (
                      <div
                        key={event.id}
                        className="flex items-center gap-3 px-3 py-3 bg-surface border border-border rounded-md"
                      >
                        <div
                          className="w-1 h-8 rounded-full flex-shrink-0"
                          style={{ backgroundColor: event.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-ink">
                            {event.checkName}
                          </div>
                          <div className="text-xs text-ink-soft">{event.title}</div>
                        </div>
                        <button
                          onClick={() => setPhaseModalNodeId(event.nodeId)}
                          className="w-7 h-7 rounded-full flex items-center justify-center text-ink-soft hover:text-burgundy hover:bg-burgundy/10 transition-colors"
                          title="Open phase details"
                        >
                          <Icon name="chevronright" size={14} />
                        </button>
                        {!isArchived && (
                          <button
                            onClick={() =>
                              setConfirmDeleteEvent({
                                nodeId: event.nodeId,
                                eventId: event.id,
                                eventName: event.checkName || 'this event',
                              })
                            }
                            className="w-7 h-7 rounded-full flex items-center justify-center text-ink-soft hover:text-status-need hover:bg-status-need/10 transition-colors"
                          >
                            <Icon name="trash" size={14} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Add new event */}
            {!isArchived && allPhases.length > 0 && (
              <div className="pt-2 border-t border-border">
                <h4 className="text-xs font-bold uppercase tracking-wider text-ink-faint mb-2">
                  Add Check
                </h4>
                <div className="flex flex-col gap-2">
                  <select
                    value={selectedPhaseId || ''}
                    onChange={(e) => setSelectedPhaseId(e.target.value)}
                    className="px-3 py-2 border border-border rounded-md bg-surface text-ink text-sm"
                  >
                    <option value="">Select a phase...</option>
                    {allPhases.map((phase) => (
                      <option key={phase.id} value={phase.id}>
                        {phase.displayName}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newEventName}
                      onChange={(e) => setNewEventName(e.target.value)}
                      placeholder="e.g. pH check"
                      className="flex-1 px-3 py-2 border border-border rounded-md bg-surface text-ink text-sm"
                    />
                    <button
                      onClick={handleAddEvent}
                      disabled={!newEventName.trim() || !selectedPhaseId}
                      className="px-4 py-2 rounded-md bg-burgundy text-white hover:bg-burgundy-deep transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-sm"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {phaseModalNode && (
        <PhaseModal
          node={phaseModalNode}
          isOpen={isOpen}
          onClose={() => setPhaseModalNodeId(null)}
          onUpdate={async () => {
            await updateSeason(appState.year, season);
            onUpdate();
          }}
          isLocked={appState.locked}
          isArchived={isArchived}
        />
      )}

      <ConfirmDialog
        isOpen={confirmDeleteEvent !== null}
        title="Delete Event"
        message={`Are you sure you want to delete "${confirmDeleteEvent?.eventName}"? This can't be undone.`}
        confirmText="Delete"
        onConfirm={handleDeleteEvent}
        onCancel={() => setConfirmDeleteEvent(null)}
        isDanger
      />
    </>
  );
}
