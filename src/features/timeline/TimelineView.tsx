import { useState, useEffect } from 'react';
import { useData } from '../../contexts/DataContext';
import type { Node } from '../../types';
import { fmtRange, derivedStatus, branchColor, TRUNK_COLOR, daysUntil, invStatus } from '../../lib/utils';
import { Icon } from '../../components/Icon';
import { PhaseModal } from './PhaseModal';
import { ConfirmDialog } from '../../components/ConfirmDialog';

export function TimelineView() {
  const { seasons, appState, updateAppState, updateSeason, inventory, deletePhase, addPhase, addBranch, deleteBranch, focusedBranchId, setFocusedBranchId } = useData();
  const season = seasons[appState.year];
  const inv = inventory[appState.year];

  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [addingPhase, setAddingPhase] = useState(false);
  const [newPhaseName, setNewPhaseName] = useState('');
  const [addingPhaseContext, setAddingPhaseContext] = useState<{ parentNodeId?: string | null; branchId?: string | null; afterNodeId?: string | null } | null>(null);
  const [branchingNode, setBranchingNode] = useState<Node | null>(null);
  const [newBranchName, setNewBranchName] = useState('');
  const [confirmDeleteBranch, setConfirmDeleteBranch] = useState<{ node: Node; branchId: string } | null>(null);
  const [confirmDeletePhase, setConfirmDeletePhase] = useState<{ id: string; name: string } | null>(null);

  const isLocked = appState.locked;
  const isArchived = season?.status !== 'current';

  // Auto-open phase modal when navigating from calendar
  // MUST be before early return to satisfy React hooks rules
  useEffect(() => {
    if (!season || !appState.focusedNodeId) return;

    // Helper function to find a node by ID
    const findNodeById = (nodeId: string): Node | null => {
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

    const node = findNodeById(appState.focusedNodeId);
    if (node) {
      setSelectedNode(node);
    }
    // Clear the focusedNodeId after handling it
    updateAppState({ focusedNodeId: null });
  }, [season, appState.focusedNodeId, updateAppState]);

  if (!season) {
    return (
      <div className="p-8 text-center flex items-center justify-center" style={{ minHeight: '400px' }}>
        <div className="text-lg font-semibold text-ink-soft">
          No season exists for {appState.year}
        </div>
      </div>
    );
  }

  const handleAddPhase = async () => {
    if (!newPhaseName.trim() || !addingPhaseContext) return;

    await addPhase(appState.year, newPhaseName.trim(), {
      parentNodeId: addingPhaseContext.parentNodeId || undefined,
      branchId: addingPhaseContext.branchId || undefined,
      afterNodeId: addingPhaseContext.afterNodeId || undefined,
    });
    
    setNewPhaseName('');
    setAddingPhase(false);
    setAddingPhaseContext(null);
  };

  const handleDeletePhase = async () => {
    if (!confirmDeletePhase) return;
    try {
      await deletePhase(appState.year, confirmDeletePhase.id);
      setConfirmDeletePhase(null);
    } catch (error) {
      console.error('Failed to delete phase:', error);
      alert('Failed to delete phase. Please try again.');
    }
  };

  const handleSplitPhase = async (node: Node) => {
    if (!newBranchName.trim()) return;

    await addBranch(appState.year, node.id, newBranchName.trim());
    
    setNewBranchName('');
    setBranchingNode(null);
  };

  const handleDeleteBranch = async (node: Node, branchId: string) => {
    if (!node.branches) return;

    await deleteBranch(appState.year, node.id, branchId);
    setConfirmDeleteBranch(null);
  };

  const handleSelectBranch = (nodeId: string, branchId: string) => {
    // Set as focused branch
    setFocusedBranchId(branchId);
    // Also update the branch selection for display
    updateAppState({
      branchSelection: {
        ...appState.branchSelection,
        [nodeId]: branchId,
      },
    });
  };

  // Get all node IDs that should be highlighted when a branch is focused
  const getHighlightedNodeIds = (): Set<string> => {
    const highlighted = new Set<string>();
    if (!focusedBranchId || !season) return highlighted;

    // Find the focused branch and collect ALL ancestors up to root + branch nodes
    function walkAndCollect(nodes: Node[], ancestors: string[]): boolean {
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const currentAncestors = [...ancestors, ...nodes.slice(0, i).map(n => n.id)];
        
        if (node.branches) {
          for (const branch of node.branches) {
            if (branch.id === focusedBranchId) {
              // Found the focused branch!
              // Add all ancestors (including preceding siblings)
              currentAncestors.forEach(id => highlighted.add(id));
              // Add this node (parent of the branch)
              highlighted.add(node.id);
              // Add all nodes in the focused branch
              function collectBranchNodes(branchNodes: Node[]) {
                for (const n of branchNodes) {
                  highlighted.add(n.id);
                  if (n.branches) {
                    n.branches.forEach(b => collectBranchNodes(b.nodes));
                  }
                }
              }
              collectBranchNodes(branch.nodes);
              return true;
            }
            // Recurse into this branch
            if (walkAndCollect(branch.nodes, [...currentAncestors, node.id])) {
              return true;
            }
          }
        }
      }
      return false;
    }

    walkAndCollect(season.root, []);
    return highlighted;
  };

  const highlightedNodeIds = getHighlightedNodeIds();

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

  const renderNodeList = (nodes: Node[], accent: string = TRUNK_COLOR, parentNodeId: string | null = null, branchId: string | null = null) => {
    return nodes.map((node, index) => {
      const selectedBranch = node.branches
        ? node.branches.find((b) => b.id === appState.branchSelection[node.id]) || node.branches[0]
        : null;

      // Check if this node should be highlighted
      const isHighlighted = !focusedBranchId || highlightedNodeIds.has(node.id);

      return (
        <div key={node.id}>
          <PhaseCard
            node={node}
            isFirst={index === 0}
            isLast={index === nodes.length - 1}
            accent={accent}
            onOpenModal={() => setSelectedNode(node)}
            onDelete={() => setConfirmDeletePhase({ id: node.id, name: node.name })}
            onBranch={() => setBranchingNode(node)}
            onAddPhase={() => {
              setAddingPhase(true);
              setAddingPhaseContext({ afterNodeId: node.id, branchId: branchId });
            }}
            isLocked={isLocked}
            isArchived={isArchived}
            alert={getPhaseAlert(node)}
            isHighlighted={isHighlighted}
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
                  const isFocused = branch.id === focusedBranchId;

                  return (
                    <div
                      key={branch.id}
                      className={`flex items-center gap-2 px-3 py-2 rounded-md border transition-colors ${
                        isSelected || isFocused
                          ? 'bg-surface border-border'
                          : 'bg-surface-2 border-transparent'
                      }`}
                      style={
                        isSelected || isFocused
                          ? {
                              backgroundColor: `color-mix(in srgb, ${branchAccent} 14%, var(--surface))`,
                              borderColor: branchAccent,
                            }
                          : {}
                      }
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectBranch(node.id, branch.id)}
                        className="flex flex-1 items-center gap-2 text-left"
                      >
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{
                            backgroundColor: branchAccent,
                            opacity: (isSelected || isFocused) ? 1 : 0.45,
                          }}
                        />
                        <span
                          className="text-xs font-semibold"
                          style={{
                            color: (isSelected || isFocused) ? branchAccent : 'var(--ink-faint)',
                            fontWeight: (isSelected || isFocused) ? 700 : 600,
                          }}
                        >
                          {branch.name}
                        </span>
                      </button>
                      {!isLocked && !isArchived && (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteBranch({ node, branchId: branch.id })}
                          className="w-5 h-5 rounded-full flex items-center justify-center text-ink-soft hover:text-status-need hover:bg-status-need/10 transition-colors"
                        >
                          <Icon name="trash" size={11} />
                        </button>
                      )}
                    </div>
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

              {selectedBranch && (
                <>
                  {selectedBranch.nodes.length > 0 && (
                    renderNodeList(
                      selectedBranch.nodes,
                      branchColor(accent, node.branches.indexOf(selectedBranch)),
                      node.id,
                      selectedBranch.id
                    )
                  )}
                  
                  {/* Add phase button for this branch - only show for EMPTY branches and if focused or no branch is focused */}
                  {!isLocked && !isArchived && selectedBranch.nodes.length === 0 && (!focusedBranchId || focusedBranchId === selectedBranch.id) && (
                    <div className="ml-6">
                      {addingPhase && addingPhaseContext?.parentNodeId === node.id && addingPhaseContext?.branchId === selectedBranch.id ? (
                        <div className="bg-surface-2 border border-border rounded-lg p-3 mt-2">
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
                                setAddingPhaseContext(null);
                              }}
                              className="flex-1 px-3 py-2 bg-surface border border-border text-ink rounded-md text-sm font-semibold hover:bg-surface-2 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setAddingPhase(true);
                            setAddingPhaseContext({ parentNodeId: node.id, branchId: selectedBranch.id });
                          }}
                          className="w-full mt-2 px-4 py-3 border-2 border-dashed border-border rounded-lg text-ink-faint font-semibold text-sm hover:text-ink-soft hover:border-barrel transition-colors flex items-center justify-center gap-2"
                        >
                          <Icon name="plus" size={14} />
                          Add Phase to {selectedBranch.name}
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      );
    });
  };

  return (
    <div className="pb-20">
      {/* Branch focus control */}
      {focusedBranchId && (
        <div className="bg-surface px-4 py-2 border-b border-border text-center">
          <button
            onClick={() => setFocusedBranchId(null)}
            className="text-xs font-semibold text-barrel hover:underline"
          >
            Clear branch focus
          </button>
        </div>
      )}

      {/* Phase list */}
      <div className="p-4">
        {season.root.length === 0 && !addingPhase ? (
          <div className="text-center py-8">
            <p className="text-ink-faint mb-3">No phases yet</p>
            {!isLocked && !isArchived && (
              <button
                onClick={() => {
                  setAddingPhase(true);
                  setAddingPhaseContext({ parentNodeId: null, branchId: null });
                }}
                className="text-burgundy font-semibold hover:underline"
              >
                + Add first phase
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {renderNodeList(season.root)}

            {/* Bottom "Add Phase" button removed - use + button on phase cards instead */}
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
          isLocked={isLocked}
          isArchived={isArchived}
        />
      )}

      {/* Branch creation modal */}
      {branchingNode && (
        <div
          role="dialog"
          aria-modal="true"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              setBranchingNode(null);
              setNewBranchName('');
            }
          }}
          className="fixed inset-0 bg-cellar/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
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

      {/* Delete phase confirmation */}
      <ConfirmDialog
        isOpen={confirmDeletePhase !== null}
        title="Delete Phase"
        message={`Delete phase "${confirmDeletePhase?.name}"? All notes and data for this phase will be permanently removed.`}
        confirmText="Delete"
        onConfirm={handleDeletePhase}
        onCancel={() => setConfirmDeletePhase(null)}
        isDanger
      />

      {/* Add phase modal - show when adding after a phase (afterNodeId) or adding first phase (no parent/branch) */}
      {addingPhase && addingPhaseContext && (addingPhaseContext.afterNodeId || (addingPhaseContext.parentNodeId === null && addingPhaseContext.branchId === null)) && (
        <div
          role="dialog"
          aria-modal="true"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              setAddingPhase(null);
              setNewPhaseName('');
            }
          }}
          className="fixed inset-0 bg-cellar/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <div className="bg-parchment rounded-xl shadow-2xl w-full max-w-sm p-4">
            <h3 className="text-base font-bold text-ink mb-3">
              Add Phase
            </h3>
            <input
              type="text"
              value={newPhaseName}
              onChange={(e) => setNewPhaseName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddPhase()}
              placeholder="Phase name"
              autoFocus
              className="w-full px-3 py-2 mb-4 border border-border rounded-md bg-surface text-ink text-sm"
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
                  setAddingPhaseContext(null);
                }}
                className="flex-1 px-3 py-2 bg-surface border border-border text-ink rounded-md text-sm font-semibold hover:bg-surface-2 transition-colors"
              >
                Cancel
              </button>
            </div>
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
  onBranch: () => void;
  onAddPhase: () => void;
  isLocked: boolean;
  isArchived: boolean;
  alert: { text: string; type: 'event' | 'inv' } | null;
  isHighlighted: boolean;
}

function PhaseCard({ node, isFirst, isLast, accent, onOpenModal, onDelete, onBranch, onAddPhase, isLocked, isArchived, alert, isHighlighted }: PhaseCardProps) {
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
        <div
          onClick={onOpenModal}
          className={`w-full bg-surface border rounded-lg p-3 text-left hover:bg-surface-2 transition-all cursor-pointer ${
            status === 'done' ? 'opacity-60' : ''
          } ${!isHighlighted ? 'opacity-40' : ''}`}
          style={{
            borderColor: status === 'active' ? accent : 'var(--border)',
            borderLeftColor: accent,
            borderLeftWidth: '3px',
            transform: isHighlighted ? 'scale(1)' : 'scale(0.98)',
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
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Status badge - only show in lock mode */}
              {isLocked && (
                <div
                  className="flex items-center gap-1 text-xs font-semibold"
                  style={{ color: config.color }}
                >
                  {config.icon && <Icon name={config.icon as any} size={12} />}
                  <span>{config.label}</span>
                </div>
              )}
              {/* Action buttons - only show in edit mode */}
              {!isLocked && !isArchived && (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onBranch();
                    }}
                    className="w-6 h-6 rounded-md flex items-center justify-center text-ink-soft hover:text-burgundy hover:bg-burgundy/10 transition-colors"
                    title="Create branch"
                  >
                    <Icon name="branch" size={12} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddPhase();
                    }}
                    className="w-6 h-6 rounded-md flex items-center justify-center text-ink-soft hover:text-burgundy hover:bg-burgundy/10 transition-colors"
                    title="Add phase"
                  >
                    <Icon name="plus" size={12} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete();
                    }}
                    className="w-6 h-6 rounded-md flex items-center justify-center text-ink-soft hover:text-status-need hover:bg-status-need/10 transition-colors"
                    title="Delete phase"
                  >
                    <Icon name="trash" size={12} />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

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

export default TimelineView;
