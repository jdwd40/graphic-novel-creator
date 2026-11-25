import type { Edge, Node } from '@xyflow/react';
import { BEHAVIOUR_PRESETS, TOUGHNESS_PRESETS } from '../combat/constants';
import { ensureSeedArtworkRegistered, SEED_IMAGE_IDS } from '../story/artwork';
import type { EncounterNode, PassageNode, Story } from '../story/types';
import { getVisibleEncounterExitKeys } from './EncounterNodeCard';

export type BuilderNode = Node;

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
          });
        }
      }
    } else {
      const visibleExits = new Set(getVisibleEncounterExitKeys(node));
      for (const [exitKey, target] of Object.entries(node.exitTargets)) {
        if (!visibleExits.has(exitKey)) continue;
        if (target && story.nodes[target]) {
          edges.push({
            id: `${node.id}:${exitKey}->${target}`,
            source: node.id,
            sourceHandle: exitKey,
            target,
            label: node.encounter.exits[exitKey]?.label ?? exitKey,
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
