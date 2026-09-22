import type { Branch, Node } from '../types';

export interface TreeValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Return the nodes that remain visible when a branch is focused. The shared
 * helper keeps the Timeline and Tree views on the same focus semantics.
 */
export function getHighlightedNodeIds(root: Node[], focusedBranchId: string | null): Set<string> {
  const highlighted = new Set<string>();
  if (!focusedBranchId) return highlighted;

  function collectBranchNodes(nodes: Node[]) {
    for (const node of nodes) {
      highlighted.add(node.id);
      node.branches?.forEach((branch) => collectBranchNodes(branch.nodes));
    }
  }

  function walk(nodes: Node[], ancestors: string[]): boolean {
    for (let index = 0; index < nodes.length; index += 1) {
      const node = nodes[index];
      const currentAncestors = [...ancestors, ...nodes.slice(0, index).map((item) => item.id)];

      for (const branch of node.branches || []) {
        if (branch.id === focusedBranchId) {
          currentAncestors.forEach((id) => highlighted.add(id));
          highlighted.add(node.id);
          collectBranchNodes(branch.nodes);
          return true;
        }
        if (walk(branch.nodes, [...currentAncestors, node.id])) return true;
      }
    }
    return false;
  }

  walk(root, []);
  return highlighted;
}

export function hasBranchId(root: Node[], branchId: string): boolean {
  return root.some((node) => node.branches?.some(
    (branch) => branch.id === branchId || hasBranchId(branch.nodes, branchId),
  ) ?? false);
}

/** Validate the recursive tree invariants before persisting a season. */
export function validateTree(root: Node[]): TreeValidationResult {
  const errors: string[] = [];
  const seenNodeIds = new Set<string>();
  const seenBranchIds = new Set<string>();

  const visitNodes = (nodes: Node[], path: string) => {
    nodes.forEach((node, index) => {
      const nodePath = `${path}[${index}]`;
      if (seenNodeIds.has(node.id)) errors.push(`Duplicate node id: ${node.id}`);
      seenNodeIds.add(node.id);

      if (!node.id) errors.push(`${nodePath} is missing an id`);
      if (!node.name.trim()) errors.push(`${nodePath} is missing a name`);

      if (node.branches !== null) {
        if (node.branches.length < 2) {
          errors.push(`${nodePath} has ${node.branches.length} branch; branches must contain at least 2`);
        }
        visitBranches(node.branches, `${nodePath}.branches`);
      }
    });
  };

  const visitBranches = (branches: Branch[], path: string) => {
    branches.forEach((branch, index) => {
      const branchPath = `${path}[${index}]`;
      if (seenBranchIds.has(branch.id)) errors.push(`Duplicate branch id: ${branch.id}`);
      seenBranchIds.add(branch.id);
      if (!branch.id) errors.push(`${branchPath} is missing an id`);
      if (!branch.name.trim()) errors.push(`${branchPath} is missing a name`);
      visitNodes(branch.nodes, `${branchPath}.nodes`);
    });
  };

  visitNodes(root, 'root');
  return { valid: errors.length === 0, errors };
}
