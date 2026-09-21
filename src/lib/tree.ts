import type { Branch, Node } from '../types';

export interface TreeValidationResult {
  valid: boolean;
  errors: string[];
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
