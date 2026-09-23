import type { Node } from '../../types';

type NodeContent = Pick<Node, 'start' | 'end' | 'status' | 'notes' | 'events' | 'invIds' | 'libIds'>;

export interface SeasonStructureNode {
  id: string;
  name: string;
  branches: Array<{ id: string; name: string; nodes: SeasonStructureNode[] }> | null;
}

export type SeasonContent = Record<string, NodeContent>;

export function splitSeasonRoot(nodes: Node[]): { structure: SeasonStructureNode[]; content: SeasonContent } {
  const content: SeasonContent = {};
  const split = (items: Node[]): SeasonStructureNode[] => items.map((node) => {
    content[node.id] = {
      start: node.start,
      end: node.end,
      status: node.status,
      notes: node.notes,
      events: node.events,
      invIds: node.invIds,
      libIds: node.libIds,
    };
    return {
      id: node.id,
      name: node.name,
      branches: node.branches?.map((branch) => ({ id: branch.id, name: branch.name, nodes: split(branch.nodes) })) || null,
    };
  });
  return { structure: split(nodes), content };
}

export function joinSeasonRoot(structure: SeasonStructureNode[], content: SeasonContent): Node[] {
  return structure.map((node) => {
    const nodeContent = content[node.id] || {
      start: '', end: '', status: 'upcoming' as const, notes: [], events: [], invIds: [], libIds: [],
    };
    return {
      ...node,
      ...nodeContent,
      branches: node.branches?.map((branch) => ({
        ...branch,
        nodes: joinSeasonRoot(branch.nodes, content),
      })) || null,
    } as Node;
  });
}
