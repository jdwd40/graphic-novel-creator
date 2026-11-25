import type { Edge, Node } from '@xyflow/react';
import { BEHAVIOUR_PRESETS, TOUGHNESS_PRESETS } from '../combat/constants';
import { ensureSeedArtworkRegistered, SEED_IMAGE_IDS } from '../story/artwork';
import type { EncounterNode, PassageNode, Story } from '../story/types';
import { getVisibleEncounterExitKeys } from './EncounterNodeCard';

export type BuilderNode = Node;

export type EdgeKind = 'choice' | 'victory' | 'defeat' | 'retreat' | 'custom';

export interface EdgeStyleSpec {
  stroke: string;
  strokeWidth: number;
  strokeDasharray?: string;
}

export const EDGE_STYLES: Record<EdgeKind, EdgeStyleSpec> = {
  choice: { stroke: '#475569', strokeWidth: 2 },
  victory: { stroke: '#15803d', strokeWidth: 2.5, strokeDasharray: '10 4' },
  defeat: { stroke: '#b91c1c', strokeWidth: 2.5, strokeDasharray: '3 4' },
  retreat: { stroke: '#b45309', strokeWidth: 2.5, strokeDasharray: '8 4 2 4' },
  custom: { stroke: '#6d28d9', strokeWidth: 2.5, strokeDasharray: '5 3' },
};

function classifyExitEdgeKind(exitKey: string): EdgeKind {
  if (exitKey === 'victory' || exitKey === 'defeat' || exitKey === 'retreat') {
    return exitKey;
  }
  return 'custom';
}

function buildEdgePresentation(kind: EdgeKind) {
  const style = EDGE_STYLES[kind];
  return {
    type: 'smoothstep',
    style,
    data: { edgeKind: kind },
    labelStyle: { fontSize: 11, fontWeight: 700, fill: '#0f172a' },
    labelBgStyle: {
      fill: '#ffffff',
      fillOpacity: 0.94,
      stroke: style.stroke,
      strokeWidth: 1,
    },
    labelBgPadding: [6, 3] as [number, number],
    labelBgBorderRadius: 4,
  };
}

export function storyToFlowNodes(story: Story, selectedNodeId: string | null): BuilderNode[] {
  return Object.values(story.nodes).map((node) => {
    if (node.kind === 'passage') {
      return {
        id: node.id,
        type: 'passage',
        position: { ...node.position },
        selected: node.id === selectedNodeId,
        data: { passage: node, isStart: story.startNodeId === node.id },
      };
    }
    return {
      id: node.id,
      type: 'encounter',
      position: { ...node.position },
      selected: node.id === selectedNodeId,
      data: { encounterNode: node },
    };
  });
}

export function storyToFlowEdges(story: Story): Edge[] {
  const edges: Edge[] = [];
  for (const node of Object.values(story.nodes)) {
    if (node.kind === 'passage') {
      for (const choice of node.choices) {
        if (choice.targetNodeId && story.nodes[choice.targetNodeId]) {
          edges.push({
            id: `${node.id}:${choice.id}->${choice.targetNodeId}`,
            source: node.id,
            sourceHandle: choice.id,
            target: choice.targetNodeId,
            label: choice.label,
            ...buildEdgePresentation('choice'),
          });
        }
      }
    } else {
      const visibleExits = new Set(getVisibleEncounterExitKeys(node));
      for (const [exitKey, target] of Object.entries(node.exitTargets)) {
        if (!visibleExits.has(exitKey)) continue;
        if (target && story.nodes[target]) {
          const kind = classifyExitEdgeKind(exitKey);
          edges.push({
            id: `${node.id}:${exitKey}->${target}`,
            source: node.id,
            sourceHandle: exitKey,
            target,
            label: node.encounter.exits[exitKey]?.label ?? exitKey,
            ...buildEdgePresentation(kind),
          });
        }
      }
    }
  }
  return edges;
}

export function createDefaultEncounterNode(
  id: string,
  position = { x: 240, y: 240 },
): EncounterNode {
  ensureSeedArtworkRegistered();
  const standard = TOUGHNESS_PRESETS.standard;
  return {
    id,
    kind: 'encounter',
    title: 'New Enemy',
    position,
    encounter: {
      type: 'encounter',
      enemy: {
        name: 'New Enemy',
        image: SEED_IMAGE_IDS.gatehouse,
        toughness: 'standard',
        health: standard.health,
        hit: standard.hit,
      },
      behaviour: 'brawler',
      pattern: [...BEHAVIOUR_PRESETS.brawler],
      altPattern: null,
      tellClarity: standard.tellClarity,
      allowRetreat: true,
      exits: {
        victory: { effects: [] },
        defeat: { effects: [] },
        retreat: { effects: [] },
      },
    },
    exitTargets: {
      victory: null,
      defeat: null,
      retreat: null,
    },
  };
}

export function createDefaultPassageNode(
  id: string,
  position = { x: 200, y: 200 },
): PassageNode {
  return {
    id,
    kind: 'passage',
    title: 'New Passage',
    text: 'Write what happens here.',
    position,
    choices: [
      {
        id: `${id}_c1`,
        label: 'Continue',
        targetNodeId: null,
      },
    ],
  };
}

function nextUniqueNodeId(story: Story, prefix: 'passage' | 'enc'): string {
  let counter = Object.keys(story.nodes).length + 1;
  let candidate = `${prefix}_${counter}`;
  while (story.nodes[candidate]) {
    counter += 1;
    candidate = `${prefix}_${counter}`;
  }
  return candidate;
}

/**
 * Creates a passage or encounter node at `position` and links it from a source
 * node's choice handle or encounter exit handle.
 */
export function createAndLinkNodeFromHandle(
  story: Story,
  sourceNodeId: string,
  sourceHandleId: string,
  kind: 'passage' | 'encounter',
  position: { x: number; y: number },
): { story: Story; createdNodeId: string } {
  const createdNodeId = nextUniqueNodeId(story, kind === 'passage' ? 'passage' : 'enc');
  const createdNode =
    kind === 'passage'
      ? createDefaultPassageNode(createdNodeId, position)
      : createDefaultEncounterNode(createdNodeId, position);

  const sourceNode = story.nodes[sourceNodeId];
  let updatedSource = sourceNode;
  if (sourceNode) {
    if (sourceNode.kind === 'passage') {
      updatedSource = {
        ...sourceNode,
        choices: sourceNode.choices.map((c) =>
          c.id === sourceHandleId ? { ...c, targetNodeId: createdNodeId } : c,
        ),
      };
    } else {
      updatedSource = {
        ...sourceNode,
        exitTargets: {
          ...sourceNode.exitTargets,
          [sourceHandleId]: createdNodeId,
        },
      };
    }
  }

  return {
    createdNodeId,
    story: {
      ...story,
      nodes: {
        ...story.nodes,
        ...(updatedSource ? { [sourceNodeId]: updatedSource } : {}),
        [createdNodeId]: createdNode,
      },
    },
  };
}
