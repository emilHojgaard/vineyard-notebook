import type { Branch, Node } from '../types';
import { uid } from './utils.ts';

/**
 * Deletes a node while preserving descendants and the branching invariant.
 * The supplied root is mutated; callers should clone it before invoking this.
 */
export function addBranchToTree(root: Node[], parentNodeId: string, branch: Branch): void {
  const found = findNode(root, parentNodeId);
  if (!found) return;

  if (found.node.branches) {
    found.node.branches.push(branch);
    return;
  }

  const followingNodes = found.siblings.splice(found.index + 1);
  found.node.branches = [{
    id: uid('b'),
    name: 'Original',
    nodes: followingNodes,
  }, branch];
}

export function deleteBranchFromTree(root: Node[], parentNodeId: string, branchId: string): void {
  const found = findNode(root, parentNodeId);
  if (!found?.node.branches) return;

  const index = found.node.branches.findIndex(branch => branch.id === branchId);
  if (index === -1) return;
  found.node.branches.splice(index, 1);

  if (found.node.branches.length === 1) {
    const remaining = found.node.branches[0];
    found.siblings.splice(found.index + 1, 0, ...remaining.nodes);
    found.node.branches = null;
  }
}

export function deleteNodeFromTree(root: Node[], nodeId: string): void {
  const found = findNode(root, nodeId);
  if (!found) return;

  const { node, parent, siblings, index } = found;
  if (node.branches?.length) {
    if (parent) {
      const containingBranchIndex = parent.branches?.findIndex((branch) => branch.nodes === siblings) ?? -1;

      if (containingBranchIndex !== -1) {
        const containingBranch = parent.branches![containingBranchIndex];
        const before = siblings.slice(0, index);
        const after = siblings.slice(index + 1);

        if (before.length > 0) {
          // The containing branch still has a path before the deleted phase.
          // Make that last phase the new fork point instead of flattening the
          // promoted branch paths into its sibling list.
          const continuation = after.length > 0
            ? [{ id: uid('b'), name: 'Original', nodes: after }]
            : [];
          const anchor = before[before.length - 1];
          anchor.branches = [
            ...(anchor.branches || []),
            ...node.branches,
            ...continuation,
          ];
          siblings.splice(index, after.length + 1);
        } else {
          // The deleted phase is the first phase in its branch. Replace the
          // containing branch at the branch point, preserving every promoted
          // Branch object (and therefore its identity and descendants).
          const replacement = after.length > 0
            ? [...node.branches, { ...containingBranch, nodes: after }]
            : node.branches;
          parent.branches!.splice(containingBranchIndex, 1, ...replacement);
        }
        return;
      }

      // This is a defensive fallback for malformed/non-canonical trees where
      // the parent does not directly own the array containing the node.
      siblings.splice(index, 1, ...node.branches.flatMap((branch) => branch.nodes));
      return;
    }

    if (index > 0) {
      // A root phase has the preceding root phase as its only possible owner.
      // Preserve the branch objects there, and move any following trunk path
      // into an explicit continuation branch rather than flattening it.
      const previous = siblings[index - 1];
      const continuation = siblings.length > index + 1
        ? [{ id: uid('b'), name: 'Original', nodes: siblings.slice(index + 1) }]
        : [];
      previous.branches = [
        ...(previous.branches || []),
        ...node.branches,
        ...continuation,
      ];
      siblings.splice(index);
      return;
    }

    // There is no preceding trunk phase to own a deleted root phase's
    // branches. The root array has no branch container, so retain each branch
    // path's nodes (including all nested descendants) in their original order.
    // This is the only promotion that necessarily loses the deleted fork's
    // top-level Branch IDs; no independent branch is merged with another.
    const promotedNodes = node.branches.flatMap((branch) => branch.nodes);
    siblings.splice(index, 1, ...promotedNodes);
    return;
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
