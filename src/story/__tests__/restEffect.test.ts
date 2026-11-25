import { describe, expect, it } from 'vitest';
import { applyStoryEffects, createPlaythrough } from '../playthrough';
import { createSeedStory } from '../seed';
import type { PassageNode } from '../types';
import { validateStory } from '../validation';

describe('standard rest effect and validation hint', () => {
  it('restores health to effective maximum (respecting wounds)', () => {
    const story = createSeedStory();
    let pt = createPlaythrough(story);
    pt = applyStoryEffects(pt, story, [{ changeHealth: -4 }, { addWound: 'Cracked rib' }]);
    expect(pt.combat.health).toBe(2);

    pt = applyStoryEffects(pt, story, [{ rest: true }]);
    expect(pt.combat.health).toBe(5);
  });

  it('warns when a story has two or more encounters and no rest effect, and clears when rest is added', () => {
    const base = createSeedStory();
    const shrine = base.nodes.passage_shrine as PassageNode;
    const withoutRest = {
      ...base,
      nodes: {
        ...base.nodes,
        passage_shrine: {
          ...shrine,
          choices: shrine.choices.map((c) => ({
            ...c,
            effects: (c.effects ?? []).filter((e) => !('rest' in e)),
          })),
        },
      },
    };

    const msgsWithout = validateStory(withoutRest);
    expect(msgsWithout.some((m) => m.id.endsWith(':missing-rest-effect'))).toBe(true);

    const msgsWith = validateStory(base);
    expect(msgsWith.some((m) => m.id.endsWith(':missing-rest-effect'))).toBe(false);
  });
});
