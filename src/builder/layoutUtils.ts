import type { Story, StoryNode } from '../story/types';
import { getVisibleEncounterExitKeys } from './EncounterNodeCard';

export const NODE_BOX_WIDTH = 260;
export const NODE_BOX_HEIGHT = 200;
export const COL_GAP = 100;
export const ROW_GAP = 60;

function getOutgoingTargets(node: StoryNode, story: Story): string[] {
  const targets: string[] = [];
  if (node.kind === 'passage') {
    for (const c of node.choices) {
      if (c.targetNodeId && story.nodes[c.targetNodeId]) {
        targets.push(c.targetNodeId);
      }
    }
  } else {
    const visible = getVisibleEncounterExitKeys(node);
    const ordered = [
      ...['victory', 'defeat', 'retreat'].filter((k) => visible.includes(k)),
      ...visible.filter((k) => k !== 'victory' && k !== 'defeat' && k !== 'retreat'),
    ];
    for (const key of ordered) {
      const target = node.exitTargets[key];
      if (target && story.nodes[target]) {
        targets.push(target);
      }
    }
  }
  return targets;
}

/**
 * Arranges all story nodes left-to-right by BFS depth from startNodeId without overlap.
 */
export function layoutStoryLeftToRight(story: Story): Story {
  const layerByNode = new Map<string, number>();
  const queue: string[] = [];

  if (story.nodes[story.startNodeId]) {
    layerByNode.set(story.startNodeId, 0);
    queue.push(story.startNodeId);
  }

  let head = 0;
  while (head < queue.length) {
    const currentId = queue[head++];
    const currentLayer = layerByNode.get(currentId) ?? 0;
    const node = story.nodes[currentId];
    if (!node) continue;

    for (const targetId of getOutgoingTargets(node, story)) {
      if (!layerByNode.has(targetId)) {
        layerByNode.set(targetId, currentLayer + 1);
        queue.push(targetId);
      }
    }
  }

  let maxLayer = 0;
  for (const col of layerByNode.values()) {
    if (col > maxLayer) maxLayer = col;
  }

  for (const node of Object.values(story.nodes)) {
    if (!layerByNode.has(node.id)) {
      layerByNode.set(node.id, maxLayer + 1);
    }
  }

  const columns = new Map<number, StoryNode[]>();
  for (const node of Object.values(story.nodes)) {
    const col = layerByNode.get(node.id) ?? 0;
    const bucket = columns.get(col) ?? [];
    bucket.push(node);
    columns.set(col, bucket);
  }

  const nextNodes: Record<string, StoryNode> = {};
  const colStep = NODE_BOX_WIDTH + COL_GAP;
  const rowStep = NODE_BOX_HEIGHT + ROW_GAP;

  for (const [col, bucket] of columns.entries()) {
    bucket.sort((a, b) => a.position.y - b.position.y || a.id.localeCompare(b.id));
    bucket.forEach((node, rowIdx) => {
      nextNodes[node.id] = {
        ...node,
        position: {
          x: 40 + col * colStep,
          y: 40 + rowIdx * rowStep,
        },
      };
    });
  }

  return {
    ...story,
    nodes: nextNodes,
  };
}

/**
 * Returns pairs of distinct node IDs whose layout boxes intersect.
 */
export function findOverlappingNodePairs(story: Story): Array<[string, string]> {
  const nodes = Object.values(story.nodes);
  const overlaps: Array<[string, string]> = [];

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      const overlapX =
        a.position.x < b.position.x + NODE_BOX_WIDTH &&
        a.position.x + NODE_BOX_WIDTH > b.position.x;
      const overlapY =
        a.position.y < b.position.y + NODE_BOX_HEIGHT &&
        a.position.y + NODE_BOX_HEIGHT > b.position.y;
      if (overlapX && overlapY) {
        overlaps.push([a.id, b.id]);
      }
    }
  }
  return overlaps;
}
