import { validateEncounterJson } from '../combat/validation';
import type { Encounter } from '../combat/types';
import { ensureSeedArtworkRegistered } from './artwork';
import { deleteImagesForStory } from './imageStore';
import { migrateStoryToImageIds } from './migration';
import { clearPlaythrough } from './playthrough';
import { createSeedStory } from './seed';
import type { PassageNode, Story, StoryNode } from './types';

const STORY_STORAGE_PREFIX = 'gnc_story_v1_';
const STORY_INDEX_KEY = 'gnc_story_index_v1';

export function getStoryStorageKey(storyId: string): string {
  return `${STORY_STORAGE_PREFIX}${storyId}`;
}

function readStoryIndex(): string[] {
  const raw = localStorage.getItem(STORY_INDEX_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((id): id is string => typeof id === 'string');
      }
    } catch {
      // Rebuild from storage keys if corrupted
    }
  }
  const discovered: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const k = localStorage.key(i);
    if (k && k.startsWith(STORY_STORAGE_PREFIX)) {
      discovered.push(k.slice(STORY_STORAGE_PREFIX.length));
    }
  }
  return discovered;
}

function writeStoryIndex(ids: string[]): void {
  const unique = Array.from(new Set(ids));
  localStorage.setItem(STORY_INDEX_KEY, JSON.stringify(unique));
}

export function saveStory(story: Story): Story {
  for (const node of Object.values(story.nodes)) {
    if (node.kind === 'encounter') {
      const check = validateEncounterJson(node.encounter);
      if (!check.valid) {
        throw new Error(`Invalid encounter on node "${node.id}": ${check.errors.join(' ')}`);
      }
    }
  }
  const stamped: Story = {
    ...story,
    schemaVersion: story.schemaVersion ?? 2,
    updatedAt: Date.now(),
  };
  localStorage.setItem(getStoryStorageKey(stamped.id), JSON.stringify(stamped));
  const index = readStoryIndex();
  if (!index.includes(stamped.id)) {
    writeStoryIndex([...index, stamped.id]);
  }
  return stamped;
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

export function listStories(): Story[] {
  const ids = readStoryIndex();
  const stories: Story[] = [];
  for (const id of ids) {
    try {
      const loaded = loadStory(id);
      if (loaded) stories.push(loaded);
    } catch {
      // Skip malformed entry rather than crashing the library list
    }
  }
  return stories.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
}

export function createBlankStory(title = 'Untitled Story'): Story {
  const suffix = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const id = `story_${suffix}`;
  const startNode: PassageNode = {
    id: 'passage_start',
    kind: 'passage',
    title: 'Opening Scene',
    text: 'Write the opening of your story.',
    position: { x: 120, y: 140 },
    choices: [],
  };
  const story: Story = {
    id,
    title: title.trim() || 'Untitled Story',
    schemaVersion: 2,
    updatedAt: Date.now(),
    startNodeId: startNode.id,
    items: {},
    nodes: {
      [startNode.id]: startNode,
    },
  };
  return saveStory(story);
}

export function renameStory(storyId: string, nextTitle: string): Story | null {
  const existing = loadStory(storyId);
  if (!existing) return null;
  const trimmed = nextTitle.trim();
  if (!trimmed) return existing;
  return saveStory({ ...existing, title: trimmed });
}

export function duplicateStory(storyId: string): Story | null {
  const existing = loadStory(storyId);
  if (!existing) return null;
  const cloneId = `story_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const copy: Story = {
    ...(JSON.parse(JSON.stringify(existing)) as Story),
    id: cloneId,
    title: `${existing.title} (Copy)`,
    updatedAt: Date.now(),
  };
  return saveStory(copy);
}

export async function deleteStory(storyId: string): Promise<void> {
  localStorage.removeItem(getStoryStorageKey(storyId));
  clearPlaythrough(storyId);
  const nextIndex = readStoryIndex().filter((id) => id !== storyId);
  writeStoryIndex(nextIndex);
  await deleteImagesForStory(storyId);
}

export function openDemoStory(reset = false): Story {
  const existing = reset ? null : loadStory('iron-bell');
  if (existing) return existing;
  const seeded = createSeedStory();
  return saveStory(seeded);
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
