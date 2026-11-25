import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { evaluateCondition } from '../conditions';
import type { StoryStateSnapshot } from '../types';
import { createPlaythrough } from '../../story/playthrough';
import { createSeedStory } from '../../story/seed';
import type { PassageNode } from '../../story/types';
import { StoryPlayer } from '../../player/StoryPlayer';

describe('shared condition evaluator', () => {
  const state: StoryStateSnapshot = {
    flags: { knows_weakness: true, gate_open: false },
    items: ['rusty_sword', 'iron_key'],
    stats: { courage: 4, health: 6 },
  };

  it('evaluates flag, item, and stat conditions cleanly for passing and failing cases', () => {
    expect(evaluateCondition({ flag: 'knows_weakness' }, state)).toBe(true);
    expect(evaluateCondition({ flag: 'gate_open' }, state)).toBe(false);

    expect(evaluateCondition({ item: 'iron_key' }, state)).toBe(true);
    expect(evaluateCondition({ item: 'golden_key' }, state)).toBe(false);

    expect(evaluateCondition({ stat: 'courage', op: 'gte', value: 4 }, state)).toBe(true);
    expect(evaluateCondition({ stat: 'courage', op: 'gt', value: 4 }, state)).toBe(false);
    expect(evaluateCondition({ stat: 'health', op: 'eq', value: 6 }, state)).toBe(true);
    expect(evaluateCondition({ stat: 'health', op: 'lt', value: 3 }, state)).toBe(false);
  });

  it('returns false without throwing for unknown flags, items, or stats', () => {
    expect(evaluateCondition({ flag: 'missing_flag' }, state)).toBe(false);
    expect(evaluateCondition({ item: 'missing_item' }, state)).toBe(false);
    expect(evaluateCondition({ stat: 'missing_stat', op: 'gte', value: 1 }, state)).toBe(false);
  });

  it('uses the same evaluator to filter story passage choices in StoryPlayer', () => {
    const base = createSeedStory();
    const intro = base.nodes.passage_intro as PassageNode;
    const story = {
      ...base,
      nodes: {
        ...base.nodes,
        passage_intro: {
          ...intro,
          choices: [
            ...intro.choices,
            {
              id: 'c_secret',
              label: 'Use hidden key',
              targetNodeId: 'passage_shrine',
              condition: { item: 'iron_key' },
            },
          ],
        },
      },
    };

    const withoutKey = createPlaythrough(story);
    const { rerender } = render(
      <StoryPlayer key="no-key" story={story} initialPlaythrough={withoutKey} />,
    );
    expect(screen.queryByRole('button', { name: 'Use hidden key' })).not.toBeInTheDocument();

    const withKey = { ...withoutKey, items: ['iron_key'] };
    rerender(<StoryPlayer key="with-key" story={story} initialPlaythrough={withKey} />);
    expect(screen.getByRole('button', { name: 'Use hidden key' })).toBeInTheDocument();
  });
});
