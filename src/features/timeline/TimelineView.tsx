import { useState } from 'react';
import { useData } from '../../contexts/DataContext';
import type { Node, Branch } from '../../types';
import { fmtRange, derivedStatus, uid, branchColor, TRUNK_COLOR, daysUntil, invStatus } from '../../lib/utils';
import { Icon } from '../../components/Icon';
import { PhaseModal } from './PhaseModal';
import { ConfirmDialog } from '../../components/ConfirmDialog';

export function TimelineView() {
  const { seasons, appState, updateAppState, updateSeason, inventory, createSeason } = useData();
  const season = seasons[appState.year];
  const inv = inventory[appState.year];

  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [addingPhase, setAddingPhase] = useState(false);
  const [newPhaseName, setNewPhaseName] = useState('');
  const [branchingNode, setBranchingNode] = useState<Node | null>(null);
  const [newBranchName, setNewBranchName] = useState('');
  const [confirmDeleteBranch, setConfirmDeleteBranch] = useState<{ node: Node; branchId: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [showAddSeason, setShowAddSeason] = useState(false);
  const [newSeasonYear, setNewSeasonYear] = useState(new Date().getFullYear());

  const isLocked = appState.locked;
  const isArchived = season?.status !== 'current';

  const handleCreateSeason = async () => {
    setCreating(true);
    try {
      await createSeason(appState.year);
    } catch (error) {
      console.error('Failed to create season:', error);
      alert('Failed to create season. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleAddNewSeason = async () => {
    setCreating(true);
    try {
      await createSeason(newSeasonYear);
      updateAppState({ year: newSeasonYear });
      setShowAddSeason(false);
    } catch (error) {
      console.error('Failed to create season:', error);
      alert('Failed to create season. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  if (!season) {
    return (
      <div className="p-8 text-center">
        <div className="max-w-sm mx-auto">
          <div className="mb-6">
            <div className="text-lg font-semibold text-ink mb-2">
              No season exists for {appState.year}
            </div>
            <p className="text-sm text-ink-soft">
              Create a new season with 7 default winemaking phases to get started
            </p>
          </div>
          <button
            onClick={handleCreateSeason}
            disabled={creating}
            className="w-full px-6 py-3 bg-burgundy text-white font-semibold rounded-lg hover:bg-burgundy-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? 'Creating...' : `Create ${appState.year} Season`}
          </button>
          <p className="text-xs text-ink-faint mt-4">
            Default phases: Growing Season, Pre-Harvest Monitoring, Harvest & Crush,
            Primary Fermentation, Racking, Aging, and Bottling
          </p>
        </div>
      </div>
    );
  }

  const handleAddPhase = () => {
    if (!newPhaseName.trim()) return;

    const newNode: Node = {
      id: uid('n'),
      name: newPhaseName.trim(),
      start: '',
      end: '',
      status: 'upcoming',
      notes: [],
      events: [],
      invIds: [],
      libIds: [],
      branches: null,
    };

    const updatedSeason = JSON.parse(JSON.stringify(season));
    updatedSeason.root.push(newNode);
    setNewPhaseName('');
    setAddingPhase(false);
    updateSeason(appState.year, updatedSeason);
  };

  const handleDeletePhase = (nodeId: string) => {
    const updatedSeason = JSON.parse(JSON.stringify(season));
    updatedSeason.root = updatedSeason.root.filter((n) => n.id !== nodeId);
    updateSeason(appState.year, updatedSeason);
  };

  const handleSplitPhase = (node: Node) => {
    if (!newBranchName.trim()) return;

    const updatedSeason = JSON.parse(JSON.stringify(season));
    
    // Find the node in the updated season
    const updatedNode = updatedSeason.root.find((n: Node) => n.id === node.id);
    if (!updatedNode) return;

    // Find the index of this node in its parent array
    const nodeIndex = updatedSeason.root.findIndex((n: Node) => n.id === node.id);
    if (nodeIndex === -1) return;

    // Move any phases after this node into "Original" branch
    const afterNodes = updatedSeason.root.splice(nodeIndex + 1);
    const originalBranch: Branch = {
      id: uid('b'),
      name: 'Original',
      nodes: afterNodes,
    };

    // Create new branch
    const newBranch: Branch = {
      id: uid('b'),
      name: newBranchName.trim(),
      nodes: [],
    };

    // Set branches on the node (always 2+ branches)
    updatedNode.branches = [originalBranch, newBranch];

    setNewBranchName('');
    setBranchingNode(null);
    updateSeason(appState.year, updatedSeason);
  };

  const handleDeleteBranch = (node: Node, branchId: string) => {
    if (!node.branches) return;

    const updatedSeason = JSON.parse(JSON.stringify(season));
    const updatedNode = updatedSeason.root.find((n: Node) => n.id === node.id);
    if (!updatedNode || !updatedNode.branches) return;

    const branchIndex = updatedNode.branches.findIndex((b: Branch) => b.id === branchId);
    if (branchIndex === -1) return;

    // Remove the branch
    updatedNode.branches.splice(branchIndex, 1);

    // If only one branch remains, collapse back to trunk
    if (updatedNode.branches.length === 1) {
      const remaining = updatedNode.branches[0];
      const nodeIndex = updatedSeason.root.findIndex((n: Node) => n.id === node.id);
      if (nodeIndex !== -1) {
        // Splice the remaining branch's nodes back into trunk after this node
        updatedSeason.root.splice(nodeIndex + 1, 0, ...remaining.nodes);
        updatedNode.branches = null;
      }
    }

    updateSeason(appState.year, updatedSeason);
    setConfirmDeleteBranch(null);
  };

  const handleSelectBranch = (nodeId: string, branchId: string) => {
    updateAppState({
      branchSelection: {
        ...appState.branchSelection,
        [nodeId]: branchId,
      },
    });
  };

  const getPhaseAlert = (node: Node): { text: string; type: 'event' | 'inv' } | null => {
    // Check for upcoming events first (higher priority)
    const upcomingEvents = node.events.filter((ev) => {
      const days = daysUntil(ev.date);
      return node.status !== 'done' && days !== null && days <= appState.eventAlertDays;
    });

    if (upcomingEvents.length > 0) {
      return {
        text: upcomingEvents.length === 1
          ? `"${upcomingEvents[0].name}" is coming up`
          : `${upcomingEvents.length} checks coming up`,
        type: 'event',
      };
    }

    // Check for inventory shortages
    if (inv && node.invIds.length > 0) {
      const days = daysUntil(node.start);
      if (node.status !== 'done' && days !== null && days <= appState.alertDays) {
        const shortItems = node.invIds
          .map((invId) => {
            for (const section of inv.sections) {
              const item = section.items.find((i) => i.id === invId);
              if (item && invStatus(item) !== 'have') return item;
            }
            return null;
          })
          .filter(Boolean);

        if (shortItems.length > 0) {
          return {
            text: shortItems.length === 1
              ? `Short on ${shortItems[0]!.name}`
              : `Short on ${shortItems.length} items`,
            type: 'inv',
          };
        }
      }
    }

    return null;
  };

  const renderNodeList = (nodes: Node[], accent: string = TRUNK_COLOR) => {
    return nodes.map((node, index) => {
      const selectedBranch = node.branches
        ? node.branches.find((b) => b.id === appState.branchSelection[node.id]) || node.branches[0]
        : null;

      return (
        <div key={node.id}>
          <PhaseCard
            node={node}
            isFirst={index === 0}
            isLast={index === nodes.length - 1}
            accent={accent}
            onOpenModal={() => setSelectedNode(node)}
            onDelete={() => handleDeletePhase(node.id)}
            alert={getPhaseAlert(node)}
          />

          {/* Branch tabs */}
          {node.branches && (
            <>
              <div className="flex items-center gap-2 my-2 px-4">
                <div className="flex-1 h-px bg-paper-line" />
                <div className="w-1.5 h-1.5 rounded-full bg-barrel" />
                <div className="flex-1 h-px bg-paper-line" />
              </div>

              <div className="flex flex-wrap gap-2 px-4 mb-2">
                {node.branches.map((branch, idx) => {
                  const branchAccent = branchColor(accent, idx);
                  const isSelected = branch.id === selectedBranch?.id;

                  return (
                    <button
                      key={branch.id}
                      onClick={() => handleSelectBranch(node.id, branch.id)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-md border transition-colors ${
                        isSelected
                          ? 'bg-surface border-border'
                          : 'bg-surface-2 border-transparent'
                      }`}
                      style={
                        isSelected
                          ? {
                              backgroundColor: `color-mix(in srgb, ${branchAccent} 14%, var(--surface))`,
                              borderColor: branchAccent,
                            }
                          : {}
                      }
                    >
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{
                          backgroundColor: branchAccent,
                          opacity: isSelected ? 1 : 0.45,
                        }}
                      />
                      <span
                        className="text-xs font-semibold"
                        style={{
                          color: isSelected ? branchAccent : 'var(--ink-faint)',
                          fontWeight: isSelected ? 700 : 600,
                        }}
                      >
                        {branch.name}
                      </span>
                      {!isLocked && !isArchived && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteBranch({ node, branchId: branch.id });
                          }}
                          className="w-5 h-5 rounded-full flex items-center justify-center text-ink-soft hover:text-status-need hover:bg-status-need/10 transition-colors"
                        >
                          <Icon name="trash" size={11} />
                        </button>
                      )}
                    </button>
                  );
                })}

                {!isLocked && !isArchived && (
                  <button
                    onClick={() => setBranchingNode(node)}
                    className="w-9 h-9 flex items-center justify-center border-2 border-dashed border-border rounded-md text-ink-faint hover:text-ink-soft hover:border-barrel transition-colors"
                  >
                    <Icon name="plus" size={14} />
                  </button>
                )}
              </div>

              {selectedBranch && renderNodeList(selectedBranch.nodes, branchColor(accent, node.branches.indexOf(selectedBranch)))}
            </>
          )}
        </div>
      );
    });
  };

  return (
    <div className="pb-20">
      {/* Vintage bar */}
      <div className="bg-surface px-4 py-3 border-b border-border">
        <div className="flex items-center justify-center gap-3 mb-2">
          <label className="text-xs uppercase tracking-wider text-ink-soft">Season</label>
          <select
            value={appState.year}
            onChange={(e) => updateAppState({ year: parseInt(e.target.value) })}
            className="px-3 py-1.5 bg-parchment-2 text-ink border border-border rounded-md text-sm font-semibold cursor-pointer"
          >
            {Object.keys(seasons)
              .map(Number)
              .sort((a, b) => b - a)
              .map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
          </select>
          {!isLocked && (
            <button
              onClick={() => setShowAddSeason(true)}
              className="w-8 h-8 flex items-center justify-center border-2 border-dashed border-border rounded-md text-ink-faint hover:text-ink-soft hover:border-barrel transition-colors"
              title="Add new season"
            >
              <Icon name="plus" size={14} />
            </button>
          )}
        </div>
        {isArchived && (
          <div className="text-xs text-center text-ink-soft bg-surface-2 border border-border rounded-md py-1.5 px-2 flex items-center justify-center gap-2">
            <Icon name="lock" size={11} />
            <span>Archived season (read-only)</span>
          </div>
        )}
      </div>

      {/* Phase list */}
      <div className="p-4">
        {season.root.length === 0 && !addingPhase ? (
          <div className="text-center py-8">
            <p className="text-ink-faint mb-3">No phases yet</p>
            {!isLocked && !isArchived && (
              <button
                onClick={() => setAddingPhase(true)}
                className="text-burgundy font-semibold hover:underline"
              >
                + Add first phase
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {renderNodeList(season.root)}

            {/* Add phase button/form */}
            {!isLocked && !isArchived && (
              <>
                {addingPhase ? (
                  <div className="bg-surface-2 border border-border rounded-lg p-3 mt-4">
                    <input
                      type="text"
                      value={newPhaseName}
                      onChange={(e) => setNewPhaseName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddPhase()}
                      placeholder="Phase name"
                      autoFocus
                      className="w-full px-3 py-2 mb-2 border border-border rounded-md bg-surface text-ink text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleAddPhase}
                        disabled={!newPhaseName.trim()}
                        className="flex-1 px-3 py-2 bg-burgundy text-white rounded-md text-sm font-semibold hover:bg-burgundy-deep transition-colors disabled:opacity-40"
                      >
                        Add Phase
                      </button>
                      <button
                        onClick={() => {
                          setAddingPhase(false);
                          setNewPhaseName('');
                        }}
                        className="flex-1 px-3 py-2 bg-surface border border-border text-ink rounded-md text-sm font-semibold hover:bg-surface-2 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingPhase(true)}
                    className="w-full mt-4 px-4 py-3 border-2 border-dashed border-border rounded-lg text-ink-faint font-semibold text-sm hover:text-ink-soft hover:border-barrel transition-colors flex items-center justify-center gap-2"
                  >
                    <Icon name="plus" size={14} />
                    Add Phase
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Phase detail modal */}
      {selectedNode && (
        <PhaseModal
          node={selectedNode}
          isOpen={true}
          onClose={() => setSelectedNode(null)}
          onUpdate={() => updateSeason(appState.year, season)}
          onDelete={() => handleDeletePhase(selectedNode.id)}
          isLocked={isLocked}
          isArchived={isArchived}
        />
      )}

      {/* Branch creation modal */}
      {branchingNode && (
        <div className="fixed inset-0 bg-cellar/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-parchment rounded-xl shadow-2xl w-full max-w-sm p-4">
            <h3 className="text-base font-bold text-ink mb-3">Create New Branch</h3>
            <p className="text-sm text-ink-soft mb-4">
              Splitting from <strong>{branchingNode.name}</strong>
            </p>
            <input
              type="text"
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSplitPhase(branchingNode)}
              placeholder="Branch name (e.g. Red Wine)"
              autoFocus
              className="w-full px-3 py-2 mb-4 border border-border rounded-md bg-surface text-ink text-sm"
            />
            <div className="flex gap-2">
              <button
                onClick={() => handleSplitPhase(branchingNode)}
                disabled={!newBranchName.trim()}
                className="flex-1 px-3 py-2 bg-burgundy text-white rounded-md text-sm font-semibold hover:bg-burgundy-deep transition-colors disabled:opacity-40"
              >
                Create Branch
              </button>
              <button
                onClick={() => {
                  setBranchingNode(null);
                  setNewBranchName('');
                }}
                className="flex-1 px-3 py-2 bg-surface border border-border text-ink rounded-md text-sm font-semibold hover:bg-surface-2 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete branch confirmation */}
      <ConfirmDialog
        isOpen={confirmDeleteBranch !== null}
        title="Delete Branch"
        message={`Delete this branch? ${
          confirmDeleteBranch?.node.branches?.find((b) => b.id === confirmDeleteBranch.branchId)
            ?.nodes.length || 0
        } phase(s) will be removed.`}
        confirmText="Delete"
        onConfirm={() => {
          if (confirmDeleteBranch) {
            handleDeleteBranch(confirmDeleteBranch.node, confirmDeleteBranch.branchId);
          }
        }}
        onCancel={() => setConfirmDeleteBranch(null)}
        isDanger
      />

      {/* Add new season modal */}
      {showAddSeason && (
        <div className="fixed inset-0 bg-cellar/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-parchment rounded-xl shadow-2xl w-full max-w-sm p-4">
            <h3 className="text-base font-bold text-ink mb-3">Add New Season</h3>
            <p className="text-sm text-ink-soft mb-4">
              Create a new season with 7 default winemaking phases
            </p>
            <div className="mb-4">
              <label className="text-xs uppercase tracking-wider text-ink-soft mb-2 block">
                Year
              </label>
              <select
                value={newSeasonYear}
                onChange={(e) => setNewSeasonYear(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-border rounded-md bg-surface text-ink text-sm font-semibold cursor-pointer"
              >
                {Array.from({ length: 11 }, (_, i) => new Date().getFullYear() - 5 + i).map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAddNewSeason}
                disabled={creating || !!seasons[newSeasonYear]}
                className="flex-1 px-3 py-2 bg-burgundy text-white rounded-md text-sm font-semibold hover:bg-burgundy-deep transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {creating ? 'Creating...' : 'Create Season'}
              </button>
              <button
                onClick={() => {
                  setShowAddSeason(false);
                  setNewSeasonYear(new Date().getFullYear());
                }}
                disabled={creating}
                className="flex-1 px-3 py-2 bg-surface border border-border text-ink rounded-md text-sm font-semibold hover:bg-surface-2 transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
            </div>
            {seasons[newSeasonYear] && (
              <p className="text-xs text-status-need mt-2">Season {newSeasonYear} already exists</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface PhaseCardProps {
  node: Node;
  isFirst: boolean;
  isLast: boolean;
  accent: string;
  onOpenModal: () => void;
  onDelete: () => void;
  alert: { text: string; type: 'event' | 'inv' } | null;
}

function PhaseCard({ node, isFirst, isLast, accent, onOpenModal, alert }: PhaseCardProps) {
  const status = node.start && node.end ? derivedStatus(node) : node.status;

  const statusConfig = {
    upcoming: { color: 'var(--st-upcoming)', icon: null, label: 'Upcoming' },
    active: { color: 'var(--st-active)', icon: 'dot', label: 'Active' },
    done: { color: 'var(--st-done)', icon: 'check', label: 'Done' },
  };

  const config = statusConfig[status];

  return (
    <div className="flex gap-2">
      {/* Timeline rail */}
      <div className="w-4 relative flex-shrink-0">
        <div
          className={`absolute left-1/2 -translate-x-px w-0.5 ${
            isFirst ? 'top-5' : 'top-0'
          } ${isLast ? 'h-5' : 'bottom-0'}`}
          style={{
            background: `color-mix(in srgb, ${accent} 45%, var(--paper-line))`,
          }}
        />
        <div
          className="absolute left-1/2 top-5 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full shadow-[0_0_0_3px_var(--parchment)] z-10"
          style={{ backgroundColor: accent }}
        />
      </div>

      {/* Card */}
      <div className="flex-1 pb-2">
        <button
          onClick={onOpenModal}
          className={`w-full bg-surface border rounded-lg p-3 text-left hover:bg-surface-2 transition-colors ${
            status === 'done' ? 'opacity-60' : ''
          }`}
          style={{
            borderColor: status === 'active' ? accent : 'var(--border)',
            borderLeftColor: accent,
            borderLeftWidth: '3px',
          }}
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
            <div
              className="flex items-center gap-1 text-xs font-semibold flex-shrink-0"
              style={{ color: config.color }}
            >
              {config.icon && <Icon name={config.icon as any} size={12} />}
              <span>{config.label}</span>
            </div>
          </div>
        </button>

        {alert && (
          <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-status-need/10 border border-status-need/30 rounded-md">
            <Icon name="alert" size={14} color="var(--status-need)" />
            <span className="text-xs font-semibold text-status-need">{alert.text}</span>
          </div>
        )}
      </div>
    </div>
  );
}
