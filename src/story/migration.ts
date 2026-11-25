import { ensureSeedArtworkRegistered } from './artwork';
import { getImageSync, isImageId, registerImageSync } from './imageStore';
import type { Story, StoryNode } from './types';

export const CURRENT_STORY_SCHEMA_VERSION = 2;

function hashString(input: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

function externalizeImageValue(
  value: string | undefined,
  storyId: string,
  name: string,
): { nextValue: string | undefined; changed: boolean } {
  if (!value || isImageId(value) || !value.startsWith('data:')) {
    return { nextValue: value, changed: false };
  }

  const id = `img_mig_${hashString(value)}`;
  if (!getImageSync(id)) {
    const mimeMatch = value.match(/^data:([^;,]+)/);
    registerImageSync({
      id,
      storyId,
      name,
      mimeType: mimeMatch?.[1] ?? 'image/png',
      dataUrl: value,
      createdAt: Date.now(),
    });
  }
  return { nextValue: id, changed: true };
}

export function migrateStoryToImageIds(story: Story): { story: Story; changed: boolean } {
  ensureSeedArtworkRegistered();
  let changed = (story.schemaVersion ?? 1) < CURRENT_STORY_SCHEMA_VERSION;

  const coverRes = externalizeImageValue(story.coverImage, story.id, `${story.title}-cover`);
  if (coverRes.changed) changed = true;

  const portraitRes = externalizeImageValue(
    story.playerPortrait,
    story.id,
    `${story.title}-portrait`,
  );
  if (portraitRes.changed) changed = true;

  const nextItems = { ...story.items };
  for (const [itemId, item] of Object.entries(story.items)) {
    const itemRes = externalizeImageValue(item.image, story.id, item.name || itemId);
    if (itemRes.changed) {
      changed = true;
      nextItems[itemId] = { ...item, image: itemRes.nextValue };
    }
  }

  const nextNodes: Record<string, StoryNode> = { ...story.nodes };
  for (const [nodeId, node] of Object.entries(story.nodes)) {
    if (node.kind === 'passage') {
      const passageRes = externalizeImageValue(node.image, story.id, node.title || nodeId);
      if (passageRes.changed) {
        changed = true;
        nextNodes[nodeId] = { ...node, image: passageRes.nextValue };
      }
    } else {
      let encounterChanged = false;
      const enemyRes = externalizeImageValue(
        node.encounter.enemy.image,
        story.id,
        node.encounter.enemy.name || nodeId,
      );
      if (enemyRes.changed) encounterChanged = true;

      let nextArt = node.encounter.art;
      if (node.encounter.art) {
        const updatedArt = { ...node.encounter.art };
        let artChanged = false;
        for (const [artKey, artVal] of Object.entries(node.encounter.art)) {
          const res = externalizeImageValue(
            artVal,
            story.id,
            `${node.encounter.enemy.name}-${artKey}`,
          );
          if (res.changed && res.nextValue) {
            (updatedArt as Record<string, string>)[artKey] = res.nextValue;
            artChanged = true;
          }
        }
        if (artChanged) {
          nextArt = updatedArt;
          encounterChanged = true;
        }
      }

      let nextPhases = node.encounter.phases;
      if (node.encounter.phases) {
        let phasesChanged = false;
        const updatedPhases = node.encounter.phases.map((phase, idx) => {
          const res = externalizeImageValue(
            phase.image,
            story.id,
            `${node.encounter.enemy.name}-phase-${idx + 2}`,
          );
          if (res.changed) {
            phasesChanged = true;
            return { ...phase, image: res.nextValue };
          }
          return phase;
        });
        if (phasesChanged) {
          nextPhases = updatedPhases;
          encounterChanged = true;
        }
      }

      if (encounterChanged) {
        changed = true;
        nextNodes[nodeId] = {
          ...node,
          encounter: {
            ...node.encounter,
            enemy: {
              ...node.encounter.enemy,
              image: enemyRes.nextValue ?? node.encounter.enemy.image,
            },
            art: nextArt,
            phases: nextPhases,
          },
        };
      }
    }
  }

  if (!changed && story.schemaVersion === CURRENT_STORY_SCHEMA_VERSION) {
    return { story, changed: false };
  }

  return {
    changed: true,
    story: {
      ...story,
      schemaVersion: CURRENT_STORY_SCHEMA_VERSION,
      coverImage: coverRes.nextValue,
      playerPortrait: portraitRes.nextValue,
      items: nextItems,
      nodes: nextNodes,
    },
  };
}
