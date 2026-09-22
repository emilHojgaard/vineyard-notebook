import { useState, useMemo, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { useData } from '../../contexts/DataContext';
import type { Node } from '../../types';
import { branchColor, TRUNK_COLOR, derivedStatus } from '../../lib/utils';
import { Icon } from '../../components/Icon';
import { PhaseModal } from '../timeline/PhaseModal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { notifyError } from '../../lib/notifications';
import { DataState } from '../../components/DataState';

interface LayoutNode {
  node: Node;
  x: number;
  y: number;
  col: number;
  accent: string;
  parentColor: string;
  branchId: string | null;
}

interface LayoutEdge {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
}

interface TreeLayout {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  width: number;
  height: number;
}

const NODE_WIDTH = 140;
const NODE_HEIGHT = 40;
const COL_GAP = 80;
const ROW_GAP = 70;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.5;
const KEYBOARD_ZOOM_STEP = 1.1;

interface ZoomAnchor {
  x: number;
  y: number;
}

interface PendingScroll {
  left: number;
  top: number;
}

interface PinchState {
  initialDistance: number;
  initialZoom: number;
  contentX: number;
  contentY: number;
}

export function TreeView() {
  const { seasons, appState, currentProject, updateAppState, updateSeason, deletePhase, addPhase, addBranch, deleteBranch, focusedBranchId, setFocusedBranchId, dataLoading, dataError, connectionStatus, retryData } = useData();
  const season = seasons[appState.year];
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [confirmDeletePhase, setConfirmDeletePhase] = useState<{ id: string; name: string } | null>(null);
  const [addingPhase, setAddingPhase] = useState<{ afterNodeId?: string; parentNodeId?: string; branchId?: string } | null>(null);
  const [newPhaseName, setNewPhaseName] = useState('');
  const [branchingNode, setBranchingNode] = useState<Node | null>(null);
  const [newBranchName, setNewBranchName] = useState('');
  const [confirmDeleteBranch, setConfirmDeleteBranch] = useState<{ node: Node; branchId: string } | null>(null);
  const [zoom, setZoom] = useState(1);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(zoom);
  const pendingScrollRef = useRef<PendingScroll | null>(null);
  const pinchRef = useRef<PinchState | null>(null);
  const treeContentRef = useRef<HTMLDivElement>(null);
  const userHasScrolledRef = useRef(false);
  const suppressScrollRef = useRef(false);

  const isLocked = appState.locked;
  const isArchived = season?.status !== 'current';

  const layout = useMemo(() => {
    if (!season) return null;
    return buildTreeLayout(season.root);
  }, [season]);

  const clampZoom = (value: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));

  // Apply a zoom while keeping the point under the anchor in the same place.
  // The scaled wrapper below keeps native overflow scrolling as the pan model.
  const zoomAt = useCallback((value: number, anchor?: ZoomAnchor, content?: ZoomAnchor) => {
    const container = scrollContainerRef.current;
    const currentZoom = zoomRef.current;
    const nextZoom = clampZoom(value);
    if (!container || nextZoom === currentZoom) return;

    const rect = container.getBoundingClientRect();
    const { left: insetX, top: insetY } = getScrollInsets(container);
    const anchorX = (anchor?.x ?? rect.left + rect.width / 2) - rect.left - insetX;
    const anchorY = (anchor?.y ?? rect.top + rect.height / 2) - rect.top - insetY;
    const contentX = content?.x ?? (container.scrollLeft + anchorX) / currentZoom;
    const contentY = content?.y ?? (container.scrollTop + anchorY) / currentZoom;

    pendingScrollRef.current = {
      left: contentX * nextZoom - anchorX,
      top: contentY * nextZoom - anchorY,
    };
    userHasScrolledRef.current = true;
    zoomRef.current = nextZoom;
    setZoom(nextZoom);
  }, []);

  // Apply scroll adjustments after the scaled wrapper has been laid out.
  useLayoutEffect(() => {
    const pendingScroll = pendingScrollRef.current;
    const container = scrollContainerRef.current;
    if (!pendingScroll || !container) return;

    container.scrollLeft = pendingScroll.left;
    container.scrollTop = pendingScroll.top;
    pendingScrollRef.current = null;
  }, [zoom]);

  // A different season starts at the same initial zoom as the existing centered view.
  useEffect(() => {
    zoomRef.current = 1;
    pendingScrollRef.current = null;
    setZoom(1);
  }, [appState.year]);

  // Center only when the project, season, or tree structure changes. Field edits
  // and user panning must not reset the user's position.
  const treeStructureKey = useMemo(
    () => season ? getTreeStructureKey(season.root) : null,
    [season]
  );
  const centeringKey = currentProject && treeStructureKey !== null
    ? `${currentProject.id}:${appState.year}:${treeStructureKey}`
    : null;

  useLayoutEffect(() => {
    if (!centeringKey) return;

    const container = scrollContainerRef.current;
    const treeContent = treeContentRef.current;
    if (!container || !treeContent) return;

    userHasScrolledRef.current = false;
    let disposed = false;
    let frame = 0;
    let secondFrame = 0;
    let releaseFrame = 0;

    const centerTree = () => {
      if (disposed || userHasScrolledRef.current) return;
      const containerRect = container.getBoundingClientRect();
      const treeRect = treeContent.getBoundingClientRect();
      const containerWidth = container.clientWidth;
      const treeWidth = treeRect.width;
      const scrollWidth = container.scrollWidth;
      if (containerWidth <= 0 || treeWidth <= 0 || scrollWidth <= 0) return;

      const maxScrollLeft = Math.max(0, scrollWidth - container.clientWidth);
      const treeCenter = treeRect.left + treeWidth / 2;
      const viewportCenter = containerRect.left + containerWidth / 2;
      const centeredScrollLeft = container.scrollLeft + treeCenter - viewportCenter;
      const scrollLeft = Math.min(maxScrollLeft, Math.max(0, centeredScrollLeft));

      suppressScrollRef.current = true;
      container.scrollLeft = scrollLeft;
      releaseFrame = requestAnimationFrame(() => {
        suppressScrollRef.current = false;
      });
    };

    const scheduleCentering = () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(secondFrame);
      frame = requestAnimationFrame(() => {
        secondFrame = requestAnimationFrame(centerTree);
      });
    };

    const handleScroll = () => {
      if (!suppressScrollRef.current) userHasScrolledRef.current = true;
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(() => {
        if (!userHasScrolledRef.current) scheduleCentering();
      });
    resizeObserver?.observe(container);
    resizeObserver?.observe(treeContent);
    scheduleCentering();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      cancelAnimationFrame(secondFrame);
      cancelAnimationFrame(releaseFrame);
      suppressScrollRef.current = false;
      resizeObserver?.disconnect();
      container.removeEventListener('scroll', handleScroll);
    };
  }, [centeringKey]);

  // Handle only multi-touch gestures here. Wheel events remain native so PC
  // users can scroll and pan the tree normally.
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const getTouchDistance = (touches: TouchList) => {
      const first = touches[0];
      const second = touches[1];
      return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
    };

    const getTouchCenter = (touches: TouchList): ZoomAnchor => ({
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    });

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length < 2) return;
      const center = getTouchCenter(event.touches);
      const rect = container.getBoundingClientRect();
      const { left: insetX, top: insetY } = getScrollInsets(container);
      const currentZoom = zoomRef.current;
      pinchRef.current = {
        initialDistance: getTouchDistance(event.touches),
        initialZoom: currentZoom,
        contentX: (container.scrollLeft + center.x - rect.left - insetX) / currentZoom,
        contentY: (container.scrollTop + center.y - rect.top - insetY) / currentZoom,
      };
      event.preventDefault();
    };

    const handleTouchMove = (event: TouchEvent) => {
      const pinch = pinchRef.current;
      if (!pinch || event.touches.length < 2) return;
      event.preventDefault();

      const center = getTouchCenter(event.touches);
      const nextZoom = clampZoom(
        pinch.initialZoom * (getTouchDistance(event.touches) / pinch.initialDistance),
      );
      const rect = container.getBoundingClientRect();
      const { left: insetX, top: insetY } = getScrollInsets(container);
      const anchorX = center.x - rect.left - insetX;
      const anchorY = center.y - rect.top - insetY;
      pendingScrollRef.current = {
        left: pinch.contentX * nextZoom - anchorX,
        top: pinch.contentY * nextZoom - anchorY,
      };
      userHasScrolledRef.current = true;
      zoomRef.current = nextZoom;
      setZoom(nextZoom);
    };

    const handleTouchEnd = (event: TouchEvent) => {
      if (event.touches.length < 2) pinchRef.current = null;
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);
    container.addEventListener('touchcancel', handleTouchEnd);
    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [zoomAt]);

  // Ctrl/Cmd +/- is scoped to the mounted TreeView, but text fields retain
  // their normal editing behavior (and browser zoom is suppressed otherwise).
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((!event.ctrlKey && !event.metaKey) || isTextInput(event.target) || !scrollContainerRef.current) return;
      const isZoomIn = event.key === '+' || event.key === '=';
      const isZoomOut = event.key === '-' || event.key === '_';
      if (!isZoomIn && !isZoomOut) return;

      event.preventDefault();
      zoomAt(zoomRef.current * (isZoomIn ? KEYBOARD_ZOOM_STEP : 1 / KEYBOARD_ZOOM_STEP));
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [zoomAt]);

  if (dataLoading || dataError) {
    return <DataState loading={dataLoading} error={dataError} connectionStatus={connectionStatus} onRetry={retryData} label="tree" />;
  }

  if (!season) {
    return (
      <div className="p-4 text-center text-ink-soft">
        <p>No season data for {appState.year}</p>
      </div>
    );
  }

  if (!layout || layout.nodes.length === 0) {
    return (
      <div className="p-4 text-center text-ink-soft">
        <p className="mb-3">No phases yet</p>
        <p className="text-sm">Add phases in the Timeline tab to see the tree view</p>
      </div>
    );
  }

  const handleFocusBranch = (branchId: string | null) => {
    setFocusedBranchId(branchId);
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

  // Determine which nodes/edges should be dimmed
  const getDimmed = (node: Node): boolean => {
    if (!focusedBranchId) return false;
    // Check if this node should be highlighted
    return !highlightedNodeIds.has(node.id);
  };

  const handleDeletePhase = async () => {
    if (!confirmDeletePhase) return;
    try {
      await deletePhase(appState.year, confirmDeletePhase.id);
      setConfirmDeletePhase(null);
    } catch (error) {
      console.error('Failed to delete phase:', error);
      notifyError('Failed to delete phase. Please try again.');
    }
  };

  const handleAddPhase = async () => {
    if (!newPhaseName.trim() || !addingPhase) return;

    await addPhase(appState.year, newPhaseName.trim(), {
      afterNodeId: addingPhase.afterNodeId,
      parentNodeId: addingPhase.parentNodeId,
      branchId: addingPhase.branchId,
    });
    
    setNewPhaseName('');
    setAddingPhase(null);
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

  return (
    <div className="pb-20">
      {/* Branch focus control */}
      {focusedBranchId && (
        <div className="bg-surface px-4 py-2 border-b border-border text-center">
          <button
            onClick={() => handleFocusBranch(null)}
            className="text-xs font-semibold text-barrel hover:underline"
          >
            Clear focus
          </button>
        </div>
      )}

      {/* Hint */}
      <div className="text-xs text-center text-ink-faint py-3 px-4">
        Click a phase to see details
        {!focusedBranchId && ' • Click a branch name to focus'}
      </div>

      {/* Tree canvas */}
      <div
        ref={scrollContainerRef}
        className="overflow-auto px-4 pb-8"
        style={{ touchAction: 'pan-x pan-y', overscrollBehaviorX: 'contain' }}
      >
        <div
          ref={treeContentRef}
          className="relative mx-auto"
          style={{
            width: layout.width * zoom,
            height: layout.height * zoom,
          }}
        >
          <div
            key={appState.year}
            className="relative"
            style={{
              width: layout.width,
              height: layout.height,
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
            }}
          >
          {/* Edges (SVG paths) */}
          <svg
            key={appState.year}
            className="absolute inset-0 pointer-events-none"
            width={layout.width}
            height={layout.height}
          >
            {layout.edges.map((edge, i) => {
              const isDim = false; // TODO: implement edge dimming based on focus
              // Create unique key from edge coordinates to prevent ghost edges when season changes
              const edgeKey = `${edge.x1}-${edge.y1}-${edge.x2}-${edge.y2}-${i}`;
              return (
                <path
                  key={edgeKey}
                  d={`M ${edge.x1} ${edge.y1} L ${edge.x2} ${edge.y2}`}
                  stroke={edge.color}
                  strokeWidth="2"
                  fill="none"
                  opacity={isDim ? 0.15 : 0.4}
                  style={{ transition: 'opacity 0.15s ease' }}
                />
              );
            })}
          </svg>

          {/* Nodes */}
          {layout.nodes.map((layoutNode) => {
            const status = layoutNode.node.start && layoutNode.node.end
              ? derivedStatus(layoutNode.node)
              : layoutNode.node.status;
            const isDim = getDimmed(layoutNode.node);
            const isActive = status === 'active';

            return (
              <div key={layoutNode.node.id}>
                <div
                  role="button"
                  tabIndex={0}
                  aria-label={`Open phase ${layoutNode.node.name}`}
                  onClick={() => setSelectedNode(layoutNode.node)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedNode(layoutNode.node);
                    }
                  }}
                  className={`absolute flex items-center gap-2 px-3 bg-surface border rounded-lg shadow-sm hover:shadow-md transition-all ${
                    status === 'done' ? 'opacity-60' : ''
                  } ${isDim ? 'opacity-25' : ''}`}
                  style={{
                    left: layoutNode.x,
                    top: layoutNode.y,
                    width: NODE_WIDTH,
                    height: NODE_HEIGHT,
                    borderColor: isActive ? layoutNode.accent : 'var(--border)',
                    borderLeftColor: layoutNode.accent,
                    borderLeftWidth: '3px',
                    transform: isDim ? 'scale(0.95)' : 'scale(1)',
                  }}
                >
                  <div className="flex-1 min-w-0 text-left">
                    <div className="text-xs font-semibold text-ink truncate">
                      {layoutNode.node.name}
                    </div>
                  </div>
                  {!isLocked && !isArchived && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setBranchingNode(layoutNode.node);
                        }}
                        className="w-5 h-5 rounded-md flex items-center justify-center text-ink-soft hover:text-burgundy hover:bg-burgundy/10 transition-colors flex-shrink-0"
                        title="Create branch"
                      >
                        <Icon name="branch" size={11} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setAddingPhase({ afterNodeId: layoutNode.node.id });
                        }}
                        className="w-5 h-5 rounded-md flex items-center justify-center text-ink-soft hover:text-burgundy hover:bg-burgundy/10 transition-colors flex-shrink-0"
                        title="Add phase"
                      >
                        <Icon name="plus" size={11} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDeletePhase({ id: layoutNode.node.id, name: layoutNode.node.name });
                        }}
                        className="w-5 h-5 rounded-md flex items-center justify-center text-ink-soft hover:text-status-need hover:bg-status-need/10 transition-colors flex-shrink-0"
                        title="Delete phase"
                      >
                        <Icon name="trash" size={11} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {/* Branch labels */}
          {getBranchLabels(season.root, layout).map((label, i) => {
            const isDim = focusedBranchId && label.branchId !== focusedBranchId;
            return (
              <div key={i}>
                {/* Branch label with delete button */}
                <div className="absolute flex items-center gap-2" style={{ left: label.x, top: label.y, transform: 'translateX(-50%)' }}>
                  <button
                    onClick={() => handleFocusBranch(label.branchId)}
                    className={`px-3 py-1 text-xs font-bold uppercase tracking-wide border rounded-md shadow-sm hover:shadow-md transition-all ${
                      isDim ? 'opacity-40' : ''
                    }`}
                    style={{
                      backgroundColor: 'var(--surface)',
                      borderColor: label.color,
                      color: label.color,
                    }}
                  >
                    {label.name}
                  </button>
                  {/* Delete button */}
                  {!isLocked && !isArchived && (
                    <button
                      onClick={() => {
                        const parentNode = findNodeById(season.root, label.parentNodeId);
                        if (parentNode) {
                          setConfirmDeleteBranch({ node: parentNode, branchId: label.branchId });
                        }
                      }}
                      className="w-6 h-6 flex items-center justify-center rounded-md text-ink-soft hover:text-status-need hover:bg-status-need/10 transition-colors"
                      style={{ opacity: isDim ? 0.4 : 1 }}
                      title="Delete branch"
                    >
                      <Icon name="trash" size={11} />
                    </button>
                  )}
                </div>
                {/* Show + button for empty branches (positioned below label like a phase would be) */}
                {!isLocked && !isArchived && label.isEmpty && (
                  <button
                    onClick={() => setAddingPhase({ parentNodeId: label.parentNodeId, branchId: label.branchId })}
                    className="absolute flex items-center justify-center gap-2 px-3 bg-surface border-2 border-dashed rounded-lg shadow-sm hover:shadow-md transition-all"
                    style={{
                      left: label.x - NODE_WIDTH / 2,
                      top: label.emptyButtonY,
                      width: NODE_WIDTH,
                      height: NODE_HEIGHT,
                      borderColor: label.color,
                      opacity: isDim ? 0.4 : 1,
                    }}
                    title="Add phase to this branch"
                  >
                    <Icon name="plus" size={14} />
                    <span className="text-xs text-ink-faint">Add Phase</span>
                  </button>
                )}
              </div>
            );
          })}
          </div>
        </div>
      </div>

      {/* Phase modal */}
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

      {/* Add phase modal */}
      {addingPhase && (
        <div className="fixed inset-0 bg-cellar/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-parchment rounded-xl shadow-2xl w-full max-w-sm p-4">
            <h3 className="text-base font-bold text-ink mb-3">
              Add Phase{addingPhase.branchId ? ' to Branch' : ''}
            </h3>
            {addingPhase.branchId && (
              <p className="text-sm text-ink-soft mb-4">
                Adding to branch
              </p>
            )}
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
                  setAddingPhase(null);
                  setNewPhaseName('');
                }}
                className="flex-1 px-3 py-2 bg-surface border border-border text-ink rounded-md text-sm font-semibold hover:bg-surface-2 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
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
    </div>
  );
}

// Build tree layout (BUILD-NOTES §4.1)
// Based on the HTML mockup's algorithm: process entire chains at once,
// checking only the LAST node for branches.
function buildTreeLayout(root: Node[]): TreeLayout {
  const nodes: LayoutNode[] = [];
  const edges: LayoutEdge[] = [];
  let nextLeafCol = 0;
  let maxY = 0;

  function walkChain(
    chain: Node[],
    startY: number,
    parentColor: string,
    branchId: string | null = null
  ): { minCol: number; maxCol: number; endY: number } {
    if (chain.length === 0) {
      return { minCol: 0, maxCol: 0, endY: startY };
    }

    let y = startY;
    let minCol: number;
    let maxCol: number;

    // Check if the LAST node in the chain has branches
    const lastNode = chain[chain.length - 1];
    const hasBranches = lastNode.branches && lastNode.branches.length > 0;

    if (hasBranches) {
      // This chain forks - recursively walk all branches
      const branchResults = lastNode.branches!.map((branch, idx) => {
        const branchColor = getBranchColor(parentColor, idx);
        const branchStartY = y + (chain.length * (NODE_HEIGHT + ROW_GAP));
        // Walk the chain even if it's empty
        if (branch.nodes.length === 0) {
          // Empty branch - assign it a column
          const col = nextLeafCol++;
          return { minCol: col, maxCol: col, endY: branchStartY };
        }
        return walkChain(branch.nodes, branchStartY, branchColor, branch.id);
      });

      // Column range is the union of all branch results
      minCol = Math.min(...branchResults.map((r) => r.minCol));
      maxCol = Math.max(...branchResults.map((r) => r.maxCol));

      // The branching node's column is the center of its children
      const centerCol = (minCol + maxCol) / 2;

      // Place all nodes in this chain, vertically aligned in the center column
      chain.forEach((node, idx) => {
        const nodeY = y + (idx * (NODE_HEIGHT + ROW_GAP));
        const x = centerCol * (NODE_WIDTH + COL_GAP);

        nodes.push({
          node,
          x,
          y: nodeY,
          col: centerCol,
          accent: parentColor,
          parentColor,
          branchId,
        });

        // Connect to next node in chain (vertical edge)
        if (idx < chain.length - 1) {
          const nextNodeY = y + ((idx + 1) * (NODE_HEIGHT + ROW_GAP));
          edges.push({
            x1: x + NODE_WIDTH / 2,
            y1: nodeY + NODE_HEIGHT,
            x2: x + NODE_WIDTH / 2,
            y2: nextNodeY,
            color: parentColor,
          });
        }
      });

      // Draw edges from the last node to each branch's first node (or branch start point for empty branches)
      const lastNodeY = y + ((chain.length - 1) * (NODE_HEIGHT + ROW_GAP));
      const lastNodeX = centerCol * (NODE_WIDTH + COL_GAP);

      lastNode.branches!.forEach((branch, idx) => {
        const branchColor = getBranchColor(parentColor, idx);
        if (branch.nodes.length > 0) {
          const branchFirstNode = nodes.find((n) => n.node.id === branch.nodes[0].id);
          if (branchFirstNode) {
            edges.push({
              x1: lastNodeX + NODE_WIDTH / 2,
              y1: lastNodeY + NODE_HEIGHT,
              x2: branchFirstNode.x + NODE_WIDTH / 2,
              y2: branchFirstNode.y,
              color: branchColor,
            });
          }
        } else {
          // Empty branch - draw edge to the branch start point
          const branchStartY = y + (chain.length * (NODE_HEIGHT + ROW_GAP));
          const branchResult = branchResults[idx];
          const branchX = branchResult.minCol * (NODE_WIDTH + COL_GAP);
          edges.push({
            x1: lastNodeX + NODE_WIDTH / 2,
            y1: lastNodeY + NODE_HEIGHT,
            x2: branchX + NODE_WIDTH / 2,
            y2: branchStartY,
            color: branchColor,
          });
        }
      });

      // End Y is the maximum of all branch end positions
      const endY = Math.max(...branchResults.map((r) => r.endY));
      maxY = Math.max(maxY, endY);

      return { minCol, maxCol, endY };
    } else {
      // This is a leaf chain - assign it the next available column
      const col = nextLeafCol++;
      const x = col * (NODE_WIDTH + COL_GAP);
      minCol = col;
      maxCol = col;

      // Place all nodes in this chain vertically in this column
      chain.forEach((node, idx) => {
        const nodeY = y + (idx * (NODE_HEIGHT + ROW_GAP));

        nodes.push({
          node,
          x,
          y: nodeY,
          col,
          accent: parentColor,
          parentColor,
          branchId,
        });

        // Connect to next node in chain (vertical edge)
        if (idx < chain.length - 1) {
          const nextNodeY = y + ((idx + 1) * (NODE_HEIGHT + ROW_GAP));
          edges.push({
            x1: x + NODE_WIDTH / 2,
            y1: nodeY + NODE_HEIGHT,
            x2: x + NODE_WIDTH / 2,
            y2: nextNodeY,
            color: parentColor,
          });
        }
      });

      const endY = y + (chain.length * (NODE_HEIGHT + ROW_GAP));
      maxY = Math.max(maxY, endY);

      return { minCol, maxCol, endY };
    }
  }

  // Walk the trunk
  if (root.length > 0) {
    walkChain(root, 20, TRUNK_COLOR);
  }

  // Calculate total width and height
  const maxCol = nextLeafCol - 1;
  const width = Math.max((maxCol + 1) * (NODE_WIDTH + COL_GAP), NODE_WIDTH + COL_GAP);
  const height = maxY + 40;

  return { nodes, edges, width, height };
}

function getBranchColor(parentColor: string, idx: number): string {
  return branchColor(parentColor, idx);
}

function getTreeStructureKey(nodes: Node[]): string {
  return nodes.map((node) => {
    const branches = node.branches?.map((branch) =>
      `${branch.id}[${getTreeStructureKey(branch.nodes)}]`
    ).join('|') || '';
    return `${node.id}{${branches}}`;
  }).join(',');
}

function getScrollInsets(element: HTMLElement): { left: number; top: number } {
  const styles = window.getComputedStyle(element);
  return {
    left: element.clientLeft + (Number.parseFloat(styles.paddingLeft) || 0),
    top: element.clientTop + (Number.parseFloat(styles.paddingTop) || 0),
  };
}

function isTextInput(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(
    target.closest('input, textarea, select, [contenteditable]'),
  );
}

function findNodeById(nodes: Node[], id: string): Node | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.branches) {
      for (const branch of node.branches) {
        const found = findNodeById(branch.nodes, id);
        if (found) return found;
      }
    }
  }
  return null;
}

function getBranchLabels(
  root: Node[],
  layout: TreeLayout
): Array<{ x: number; y: number; emptyButtonY?: number; name: string; color: string; branchId: string; isEmpty: boolean; parentNodeId: string }> {
  const labels: Array<{ x: number; y: number; emptyButtonY?: number; name: string; color: string; branchId: string; isEmpty: boolean; parentNodeId: string }> = [];

  function walk(nodes: Node[], parentColor: string, depth: number = 0) {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (node.branches) {
        node.branches.forEach((branch, idx) => {
          const branchAccent = getBranchColor(parentColor, idx);
          
          if (branch.nodes.length > 0) {
            // Branch has nodes - place label above first node
            const firstNode = layout.nodes.find((ln) => ln.node.id === branch.nodes[0].id);
            if (firstNode) {
              labels.push({
                x: firstNode.x + NODE_WIDTH / 2,
                y: firstNode.y - 25,
                name: branch.name,
                color: branchAccent,
                branchId: branch.id,
                isEmpty: false,
                parentNodeId: node.id,
              });
            }
            walk(branch.nodes, branchAccent, depth + 1);
          } else {
            // Empty branch - place label at branch point and button below
            const parentNode = layout.nodes.find((ln) => ln.node.id === node.id);
            if (parentNode) {
              // Calculate approximate position based on branch index
              // This is a simple heuristic - empty branches spread out horizontally
              const offsetX = (idx - (node.branches!.length - 1) / 2) * (NODE_WIDTH + COL_GAP);
              const labelY = parentNode.y + NODE_HEIGHT + 15; // Label positioned just below parent
              const buttonY = labelY + 35; // Button positioned below label (where first phase would be)
              labels.push({
                x: parentNode.x + NODE_WIDTH / 2 + offsetX,
                y: labelY,
                emptyButtonY: buttonY,
                name: branch.name,
                color: branchAccent,
                branchId: branch.id,
                isEmpty: true,
                parentNodeId: node.id,
              });
            }
          }
        });
      }
    }
  }

  walk(root, TRUNK_COLOR);
  return labels;
}

export default TreeView;

