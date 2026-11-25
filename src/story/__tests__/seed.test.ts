import { describe, expect, it } from 'vitest';
import { createSeedStory } from '../seed';
import type { PassageNode } from '../types';

describe('seed story artwork (#65)', () => {
  it('gives The Courtyard Gate distinct courtyard artwork and assigns unique art to each passage', () => {
    const story = createSeedStory();
    const passages = Object.values(story.nodes).filter(
      (n): n is PassageNode => n.kind === 'passage',
    );

    const intro = story.nodes.passage_intro as PassageNode;
    const armory = story.nodes.passage_armory as PassageNode;

    expect(intro.title).toBe('The Courtyard Gate');
    expect(intro.image).toBeTruthy();
    expect(intro.image).not.toBe(armory.image);
    expect(decodeURIComponent(intro.image!)).toContain('THE COURTYARD GATE');

    const images = passages.map((p) => p.image);
    expect(images.every(Boolean)).toBe(true);
    expect(new Set(images).size).toBe(passages.length);
  });
});
