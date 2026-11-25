import { describe, expect, it } from 'vitest';
import { getImageSync, isImageId } from '../imageStore';
import { createSeedStory } from '../seed';
import type { PassageNode } from '../types';

describe('seed story artwork (#65, #40)', () => {
  it('gives The Courtyard Gate distinct courtyard artwork and registers seed image IDs', () => {
    const story = createSeedStory();
    const passages = Object.values(story.nodes).filter(
      (n): n is PassageNode => n.kind === 'passage',
    );

    const intro = story.nodes.passage_intro as PassageNode;
    const armory = story.nodes.passage_armory as PassageNode;

    expect(story.schemaVersion).toBe(2);
    expect(isImageId(intro.image)).toBe(true);
    expect(intro.title).toBe('The Courtyard Gate');
    expect(intro.image).not.toBe(armory.image);

    const resolvedIntro = getImageSync(intro.image);
    expect(resolvedIntro).not.toBeNull();
    expect(decodeURIComponent(resolvedIntro!.dataUrl)).toContain('THE COURTYARD GATE');

    const images = passages.map((p) => p.image);
    expect(images.every((img) => isImageId(img))).toBe(true);
    expect(new Set(images).size).toBe(passages.length);
  });
});
