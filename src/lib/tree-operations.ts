import type { Node } from '../types';

/**
 * Deletes a node while preserving descendants and the branching invariant.
 * The supplied root is mutated; callers should clone it before invoking this.
 */
export function deleteNodeFromTree(root: Node[], nodeId: string): void {
  const found = findNode(root, nodeId);
  if (!found) return;

  const { node, parent, siblings, index } = found;
  if (node.branches?.length) {
    if (parent) {
      parent.branches = parent.branches
        ? [...parent.branches, ...node.branches]
        : node.branches;
    } else {
      if (index === 0) {
        throw new Error('Cannot delete the first root phase while it has branches; move its branches first.');
      }
      const previous = siblings[index - 1];
      previous.branches = previous.branches
        ? [...previous.branches, ...node.branches]
        : node.branches;
    }
  }

  siblings.splice(index, 1);

  if (parent?.branches?.length === 1) {
    const parentLocation = findNode(root, parent.id);
    if (parentLocation) {
      const remaining = parent.branches[0];
      parentLocation.siblings.splice(parentLocation.index + 1, 0, ...remaining.nodes);
      parent.branches = null;
    }
  }
}

function findNode(
  nodes: Node[],
  nodeId: string,
  parent: Node | null = null,
): { node: Node; parent: Node | null; siblings: Node[]; index: number } | null {
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    if (node.id === nodeId) return { node, parent, siblings: nodes, index };
    if (node.branches) {
      for (const branch of node.branches) {
        const found = findNode(branch.nodes, nodeId, node);
        if (found) return found;
      }
    }
  }
  return null;
}
