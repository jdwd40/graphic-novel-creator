import { validateEncounterJson } from '../combat/validation';
import { ensureSeedArtworkRegistered } from './artwork';
import { getImage, isImageId, saveImageDataUrl, type StoredImage } from './imageStore';
import { migrateStoryToImageIds } from './migration';
import { saveStory } from './store';
import type { Story } from './types';

export interface StoryBundle {
  format: 'gnc-story-bundle';
  version: 1;
  story: Story;
  images: StoredImage[];
}

function collectReferencedImageIds(story: Story): string[] {
  const ids = new Set<string>();
  const add = (val: string | undefined) => {
    if (isImageId(val) && val) ids.add(val);
  };
  add(story.coverImage);
  add(story.playerPortrait);
  for (const item of Object.values(story.items)) {
    add(item.image);
  }
  for (const node of Object.values(story.nodes)) {
    if (node.kind === 'passage') {
      add(node.image);
    } else {
      add(node.encounter.enemy.image);
      if (node.encounter.art) {
        for (const v of Object.values(node.encounter.art)) add(v);
      }
      if (node.encounter.phases) {
        for (const p of node.encounter.phases) add(p.image);
      }
    }
  }
  return Array.from(ids);
}

export async function exportStoryBundle(story: Story): Promise<StoryBundle> {
  ensureSeedArtworkRegistered();
  const migrated = migrateStoryToImageIds(story).story;
  const referencedIds = collectReferencedImageIds(migrated);
  const images: StoredImage[] = [];

  for (const id of referencedIds) {
    const img = await getImage(id);
    if (img) {
      images.push(img);
    }
  }

  return {
    format: 'gnc-story-bundle',
    version: 1,
    story: migrated,
    images,
  };
}

export async function importStoryBundle(rawJson: string): Promise<Story> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new Error('Invalid bundle file: unable to parse JSON.');
  }

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    (parsed as StoryBundle).format !== 'gnc-story-bundle' ||
    (parsed as StoryBundle).version !== 1
  ) {
    throw new Error('Unrecognized file format: expected a Graphic Novel Creator story bundle.');
  }

  const bundle = parsed as StoryBundle;
  if (
    !bundle.story ||
    typeof bundle.story !== 'object' ||
    typeof bundle.story.id !== 'string' ||
    typeof bundle.story.title !== 'string' ||
    typeof bundle.story.startNodeId !== 'string' ||
    !bundle.story.nodes ||
    typeof bundle.story.nodes !== 'object' ||
    !bundle.story.nodes[bundle.story.startNodeId]
  ) {
    throw new Error('Corrupt story bundle: missing required story structure or start passage.');
  }

  if (!Array.isArray(bundle.images)) {
    throw new Error('Corrupt story bundle: invalid image collection.');
  }

  // Validate encounters and image entries BEFORE mutating IndexedDB or localStorage.
  for (const node of Object.values(bundle.story.nodes)) {
    if (!node || typeof node !== 'object' || (node.kind !== 'passage' && node.kind !== 'encounter')) {
      throw new Error('Corrupt story bundle: invalid node entry.');
    }
    if (node.kind === 'encounter') {
      const check = validateEncounterJson(node.encounter);
      if (!check.valid) {
        throw new Error(`Invalid encounter in bundle: ${check.errors.join(' ')}`);
      }
    }
  }
  for (const img of bundle.images) {
    if (
      !img ||
      typeof img.id !== 'string' ||
      typeof img.dataUrl !== 'string' ||
      typeof img.name !== 'string'
    ) {
      throw new Error('Corrupt story bundle: invalid image record.');
    }
  }

  const newStoryId = `story_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const idMap = new Map<string, string>();
  for (const img of bundle.images) {
    const saved = await saveImageDataUrl(img.dataUrl, {
      storyId: newStoryId,
      name: img.name,
      mimeType: img.mimeType,
      width: img.width,
      height: img.height,
    });
    idMap.set(img.id, saved.id);
  }

  const remap = (val: string | undefined) => (val && idMap.has(val) ? idMap.get(val)! : val);

  const importedNodes = { ...bundle.story.nodes };
  for (const [nodeId, node] of Object.entries(importedNodes)) {
    if (node.kind === 'passage') {
      importedNodes[nodeId] = { ...node, image: remap(node.image) };
    } else {
      const nextArt = node.encounter.art
        ? Object.fromEntries(
            Object.entries(node.encounter.art).map(([k, v]) => [k, remap(v)]),
          )
        : undefined;
      const nextPhases = node.encounter.phases?.map((p) => ({
        ...p,
        image: remap(p.image),
      }));
      importedNodes[nodeId] = {
        ...node,
        encounter: {
          ...node.encounter,
          enemy: {
            ...node.encounter.enemy,
            image: remap(node.encounter.enemy.image) ?? node.encounter.enemy.image,
          },
          art: nextArt,
          phases: nextPhases,
        },
      };
    }
  }

  const importedItems = Object.fromEntries(
    Object.entries(bundle.story.items ?? {}).map(([k, item]) => [
      k,
      { ...item, image: remap(item.image) },
    ]),
  );

  const restoredStory: Story = {
    ...bundle.story,
    id: newStoryId,
    schemaVersion: 2,
    updatedAt: Date.now(),
    coverImage: remap(bundle.story.coverImage),
    playerPortrait: remap(bundle.story.playerPortrait),
    items: importedItems,
    nodes: importedNodes,
  };

  return saveStory(restoredStory);
}
