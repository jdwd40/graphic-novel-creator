import { validateEncounterJson } from '../combat/validation';
import type { Encounter } from '../combat/types';
import { ensureSeedArtworkRegistered } from './artwork';
import { migrateStoryToImageIds } from './migration';
import type { Story, StoryNode } from './types';

const STORY_STORAGE_PREFIX = 'gnc_story_v1_';

export function getStoryStorageKey(storyId: string): string {
  return `${STORY_STORAGE_PREFIX}${storyId}`;
}

export function saveStory(story: Story): void {
  for (const node of Object.values(story.nodes)) {
    if (node.kind === 'encounter') {
      const check = validateEncounterJson(node.encounter);
      if (!check.valid) {
        throw new Error(`Invalid encounter on node "${node.id}": ${check.errors.join(' ')}`);
      }
    }
  }
  localStorage.setItem(getStoryStorageKey(story.id), JSON.stringify(story));
}

export function loadStory(storyId: string): Story | null {
  ensureSeedArtworkRegistered();
  const raw = localStorage.getItem(getStoryStorageKey(storyId));
  if (!raw) {
    return null;
  }
  const parsed = JSON.parse(raw) as Story;
  const migrated = migrateStoryToImageIds(parsed);
  if (migrated.changed) {
    localStorage.setItem(getStoryStorageKey(storyId), JSON.stringify(migrated.story));
  }
  return migrated.story;
}

export function updateEncounterNode(
  story: Story,
  nodeId: string,
  encounter: Encounter,
  title?: string,
): Story {
  const existing = story.nodes[nodeId];
  if (!existing || existing.kind !== 'encounter') {
    throw new Error(`Encounter node "${nodeId}" not found.`);
  }

  const check = validateEncounterJson(encounter);
  if (!check.valid) {
    throw new Error(check.errors.join(' '));
  }

  const nextExitTargets: Record<string, string | null> = {};
  for (const exitKey of Object.keys(encounter.exits)) {
    if (exitKey === 'retreat' && !encounter.allowRetreat) {
      continue;
    }
    nextExitTargets[exitKey] = existing.exitTargets[exitKey] ?? null;
  }

  const updatedNode: StoryNode = {
    ...existing,
    title: title ?? encounter.enemy.name,
    encounter,
    exitTargets: nextExitTargets,
  };

  return {
    ...story,
    nodes: {
      ...story.nodes,
      [nodeId]: updatedNode,
    },
  };
}

export function setExitTarget(
  story: Story,
  encounterNodeId: string,
  exitKey: string,
  targetNodeId: string | null,
): Story {
  const existing = story.nodes[encounterNodeId];
  if (!existing || existing.kind !== 'encounter') {
    throw new Error(`Encounter node "${encounterNodeId}" not found.`);
  }

  return {
    ...story,
    nodes: {
      ...story.nodes,
      [encounterNodeId]: {
        ...existing,
        exitTargets: {
          ...existing.exitTargets,
          [exitKey]: targetNodeId,
        },
      },
    },
  };
}

export function deleteNode(story: Story, nodeId: string): Story {
  const nextNodes: Record<string, StoryNode> = {};

  for (const [id, node] of Object.entries(story.nodes)) {
    if (id === nodeId) {
      continue;
    }
    if (node.kind === 'passage') {
      nextNodes[id] = {
        ...node,
        choices: node.choices.map((choice) =>
          choice.targetNodeId === nodeId ? { ...choice, targetNodeId: null } : choice,
        ),
      };
    } else {
      const cleanedTargets: Record<string, string | null> = {};
      for (const [exitKey, target] of Object.entries(node.exitTargets)) {
        cleanedTargets[exitKey] = target === nodeId ? null : target;
      }
      nextNodes[id] = {
        ...node,
        exitTargets: cleanedTargets,
      };
    }
  }

  return {
    ...story,
    nodes: nextNodes,
  };
}
