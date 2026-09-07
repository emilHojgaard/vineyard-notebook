import { useState, useMemo } from 'react';
import { useData } from '../../contexts/DataContext';
import type { Node, Branch } from '../../types';
import { branchColor, TRUNK_COLOR, derivedStatus, uid } from '../../lib/utils';
import { Icon } from '../../components/Icon';
import { PhaseModal } from '../timeline/PhaseModal';
import { CreatePhaseModal } from '../timeline/CreatePhaseModal';

interface LayoutNode {
  node: Node;
  x: number;
  y: number;
  col: number;
  accent: string;
  parentColor: string;
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

export function TreeView() {
  const { seasons, appState, updateAppState, updateSeason, createPhase } = useData();
  const season = seasons[appState.year];
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const isLocked = appState.locked;
  const isArchived = season?.status !== 'current';
  const focusedBranchId = appState.treeFocus;

  const layout = useMemo(() => {
    if (!season) return null;
    return buildTreeLayout(season.root);
  }, [season]);

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
    updateAppState({ treeFocus: branchId });
  };

  const handleCreatePhase = async (name: string, start?: string, end?: string) => {
    try {
      await createPhase(appState.year, name, start, end);
      setShowCreateModal(false);
    } catch (error) {
      console.error('Failed to create phase:', error);
      alert('Failed to create phase. Please try again.');
    }
  };

  // Determine which nodes/edges should be dimmed
  const getDimmed = (node: Node): boolean => {
    if (!focusedBranchId) return false;
    // Check if this node is part of the focused branch
    return !isInBranch(season.root, node, focusedBranchId);
  };

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="bg-surface px-4 py-3 border-b border-border">
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-1">
            <div className="text-lg font-bold text-ink">{season.title}</div>
            {!isLocked && !isArchived && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="w-7 h-7 flex items-center justify-center border-2 border-dashed border-border rounded-md text-ink-faint hover:text-burgundy hover:border-burgundy transition-colors"
                title="Add phase"
              >
                <Icon name="plus" size={14} />
              </button>
            )}
          </div>
          <div className="text-xs text-ink-soft">
            {layout.nodes.length} phase{layout.nodes.length !== 1 ? 's' : ''}
          </div>
          {focusedBranchId && (
            <button
              onClick={() => handleFocusBranch(null)}
              className="mt-2 text-xs font-semibold text-barrel hover:underline"
            >
              Clear focus
            </button>
          )}
        </div>
      </div>

      {/* Hint */}
      <div className="text-xs text-center text-ink-faint py-3 px-4">
        Click a phase to see details
        {!focusedBranchId && ' • Click a branch name to focus'}
      </div>

      {/* Tree canvas */}
      <div className="overflow-auto px-4 pb-8">
        <div
          className="relative mx-auto"
          style={{
            width: layout.width,
            height: layout.height,
          }}
        >
          {/* Edges (SVG paths) */}
          <svg
            className="absolute inset-0 pointer-events-none"
            width={layout.width}
            height={layout.height}
          >
            {layout.edges.map((edge, i) => {
              const isDim = false; // TODO: implement edge dimming based on focus
              return (
                <path
                  key={i}
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
              <button
                key={layoutNode.node.id}
                onClick={() => setSelectedNode(layoutNode.node)}
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
              </button>
            );
          })}

          {/* Branch labels */}
          {getBranchLabels(season.root, layout).map((label, i) => {
            const isDim = focusedBranchId && label.branchId !== focusedBranchId;
            return (
              <button
                key={i}
                onClick={() => handleFocusBranch(label.branchId)}
                className={`absolute px-3 py-1 text-xs font-bold uppercase tracking-wide border rounded-md shadow-sm hover:shadow-md transition-all ${
                  isDim ? 'opacity-40' : ''
                }`}
                style={{
                  left: label.x,
                  top: label.y,
                  backgroundColor: 'var(--surface)',
                  borderColor: label.color,
                  color: label.color,
                  transform: 'translateX(-50%)',
                }}
              >
                {label.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Create phase modal */}
      <CreatePhaseModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreatePhase}
      />

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
    </div>
  );
}

// Build tree layout (BUILD-NOTES §4.1)
function buildTreeLayout(root: Node[]): TreeLayout {
  const nodes: LayoutNode[] = [];
  const edges: LayoutEdge[] = [];
  let nextLeafCol = 0;
  let maxY = 0;

  function walkChain(
    chain: Node[],
    startY: number,
    parentColor: string
  ): { minCol: number; maxCol: number; endY: number } {
    let y = startY;
    let chainCols = { minCol: Infinity, maxCol: -Infinity };

    for (let i = 0; i < chain.length; i++) {
      const node = chain[i];
      const isLeaf = !node.branches;

      if (isLeaf) {
        // Leaf node gets next available column
        const col = nextLeafCol++;
        const x = col * (NODE_WIDTH + COL_GAP);

        nodes.push({
          node,
          x,
          y,
          col,
          accent: parentColor,
          parentColor,
        });

        chainCols.minCol = Math.min(chainCols.minCol, col);
        chainCols.maxCol = Math.max(chainCols.maxCol, col);

        y += NODE_HEIGHT + ROW_GAP;
      } else {
        // Fork: walk all branches recursively
        const branchResults = node.branches!.map((branch, idx) => {
          const branchColor = getBranchColor(parentColor, idx);
          return walkChain(branch.nodes, y + NODE_HEIGHT + ROW_GAP, branchColor);
        });

        // Node's column is average of children's columns
        const childMinCol = Math.min(...branchResults.map((r) => r.minCol));
        const childMaxCol = Math.max(...branchResults.map((r) => r.maxCol));
        const col = (childMinCol + childMaxCol) / 2;
        const x = col * (NODE_WIDTH + COL_GAP);

        nodes.push({
          node,
          x,
          y,
          col,
          accent: parentColor,
          parentColor,
        });

        // Draw edges to children
        const childEndY = Math.max(...branchResults.map((r) => r.endY));
        for (const branch of node.branches!) {
          const branchFirstNode = nodes.find((n) => n.node.id === branch.nodes[0]?.id);
          if (branchFirstNode) {
            edges.push({
              x1: x + NODE_WIDTH / 2,
              y1: y + NODE_HEIGHT,
              x2: branchFirstNode.x + NODE_WIDTH / 2,
              y2: branchFirstNode.y,
              color: branchFirstNode.accent,
            });
          }
        }

        chainCols.minCol = Math.min(chainCols.minCol, childMinCol);
        chainCols.maxCol = Math.max(chainCols.maxCol, childMaxCol);
        y = childEndY;
      }

      // Connect to next node in chain
      if (i < chain.length - 1) {
        const currentNode = nodes.find((n) => n.node.id === node.id);
        const nextNode = chain[i + 1];
        if (currentNode) {
          edges.push({
            x1: currentNode.x + NODE_WIDTH / 2,
            y1: currentNode.y + NODE_HEIGHT,
            x2: currentNode.x + NODE_WIDTH / 2, // Will be updated after next node is placed
            y2: y,
            color: parentColor,
          });
        }
      }
    }

    maxY = Math.max(maxY, y);
    return { ...chainCols, endY: y };
  }

  // Walk the trunk
  walkChain(root, 20, TRUNK_COLOR);

  // Calculate total width and height
  const maxCol = nextLeafCol - 1;
  const width = (maxCol + 1) * (NODE_WIDTH + COL_GAP);
  const height = maxY + 40;

  return { nodes, edges, width, height };
}

function getBranchColor(parentColor: string, idx: number): string {
  return branchColor(parentColor, idx);
}

function getBranchLabels(
  root: Node[],
  layout: TreeLayout
): Array<{ x: number; y: number; name: string; color: string; branchId: string }> {
  const labels: Array<{ x: number; y: number; name: string; color: string; branchId: string }> = [];

  function walk(nodes: Node[], parentColor: string) {
    for (const node of nodes) {
      if (node.branches) {
        node.branches.forEach((branch, idx) => {
          const branchAccent = getBranchColor(parentColor, idx);
          const firstNode = layout.nodes.find((ln) => ln.node.id === branch.nodes[0]?.id);
          if (firstNode) {
            labels.push({
              x: firstNode.x + NODE_WIDTH / 2,
              y: firstNode.y - 25,
              name: branch.name,
              color: branchAccent,
              branchId: branch.id,
            });
          }
          walk(branch.nodes, branchAccent);
        });
      }
    }
  }

  walk(root, TRUNK_COLOR);
  return labels;
}

function isInBranch(root: Node[], target: Node, branchId: string): boolean {
  function walk(nodes: Node[]): boolean {
    for (const node of nodes) {
      if (node.id === target.id) return true;
      if (node.branches) {
        for (const branch of node.branches) {
          if (branch.id === branchId) {
            return walkNodes(branch.nodes);
          }
        }
      }
    }
    return false;
  }

  function walkNodes(nodes: Node[]): boolean {
    for (const node of nodes) {
      if (node.id === target.id) return true;
      if (node.branches) {
        for (const branch of node.branches) {
          if (walkNodes(branch.nodes)) return true;
        }
      }
    }
    return false;
  }

  return walk(root);
}
