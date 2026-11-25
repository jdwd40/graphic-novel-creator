import type { Story } from './types';

export interface ImageUsageRef {
  locationType: 'cover' | 'portrait' | 'passage' | 'item' | 'enemy' | 'artVariant' | 'phase';
  nodeId?: string;
  itemId?: string;
  label: string;
}

export function findImageUsages(story: Story, imageId: string): ImageUsageRef[] {
  if (!imageId) return [];
  const refs: ImageUsageRef[] = [];

  if (story.coverImage === imageId) {
    refs.push({ locationType: 'cover', label: 'Story cover image' });
  }
  if (story.playerPortrait === imageId) {
    refs.push({ locationType: 'portrait', label: 'Player portrait' });
  }

  for (const item of Object.values(story.items)) {
    if (item.image === imageId) {
      refs.push({
        locationType: 'item',
        itemId: item.id,
        label: `Item: ${item.name || item.id}`,
      });
    }
  }

  for (const node of Object.values(story.nodes)) {
    if (node.kind === 'passage') {
      if (node.image === imageId) {
        refs.push({
          locationType: 'passage',
          nodeId: node.id,
          label: `Passage: ${node.title || node.id}`,
        });
      }
    } else {
      if (node.encounter.enemy.image === imageId) {
        refs.push({
          locationType: 'enemy',
          nodeId: node.id,
          label: `Enemy: ${node.encounter.enemy.name || node.title || node.id}`,
        });
      }
      if (node.encounter.art) {
        for (const [variantKey, variantImg] of Object.entries(node.encounter.art)) {
          if (variantImg === imageId) {
            refs.push({
              locationType: 'artVariant',
              nodeId: node.id,
              label: `Art (${variantKey}) in ${node.encounter.enemy.name || node.title}`,
            });
          }
        }
      }
      if (node.encounter.phases) {
        node.encounter.phases.forEach((phase, index) => {
          if (phase.image === imageId) {
            refs.push({
              locationType: 'phase',
              nodeId: node.id,
              label: `Phase ${index + 2} in ${node.encounter.enemy.name || node.title}`,
            });
          }
        });
      }
    }
  }

  return refs;
}
