import { describe, expect, it } from 'vitest';
import specMarkdown from '../../../docs/combat-system-spec.md?raw';
import { EMPTY_STORY_STATE } from '../conditions';
import { BEHAVIOUR_PRESETS, GEAR_TIERS, TOUGHNESS_PRESETS } from '../constants';
import { autopilotPolicy, carefulPolicy, simulate } from '../simulator';
import type { Encounter } from '../types';

function makeBoss(phaseCount: 2 | 3, overrides: Partial<Encounter> = {}): Encounter {
  const { health, hit, tellClarity } = TOUGHNESS_PRESETS.boss;
  const phases =
    phaseCount === 2
      ? [{ healthAtMost: Math.floor(health / 2), pattern: [...BEHAVIOUR_PRESETS.brute] }]
      : [
          { healthAtMost: Math.floor((health * 2) / 3), pattern: [...BEHAVIOUR_PRESETS.brute] },
          {
            healthAtMost: Math.floor(health / 3),
            pattern: ['heavy', 'strike', 'heavy'] as Array<'strike' | 'heavy' | 'open'>,
          },
        ];

  return {
    type: 'encounter',
    enemy: {
      name: `Default ${phaseCount}-Phase Boss`,
      image: 'boss.png',
      toughness: 'boss',
      health,
      hit,
    },
    behaviour: 'brawler',
    pattern: [...BEHAVIOUR_PRESETS.brawler],
    altPattern: null,
    tellClarity,
    phases,
    allowRetreat: false,
    exits: {
      victory: { effects: [] },
      defeat: { effects: [] },
    },
    ...overrides,
  };
}

describe('boss simulation and spec tuning agreement', () => {
  it('matches the Boss row in docs/combat-system-spec.md toughness table', () => {
    const rowMatch = specMarkdown.match(
      /^\|\s*Boss\s*\|\s*(\d+)[^|]*\|\s*(\d+)\s*\|\s*(\w+)\s*\|/im,
    );
    expect(rowMatch).not.toBeNull();
    const specHealth = Number(rowMatch![1]);
    const specHit = Number(rowMatch![2]);
    const specClarity = rowMatch![3].toLowerCase();

    expect(TOUGHNESS_PRESETS.boss.health).toBe(specHealth);
    expect(TOUGHNESS_PRESETS.boss.hit).toBe(specHit);
    expect(TOUGHNESS_PRESETS.boss.tellClarity).toBe(specClarity);
  });

  it('allows a careful reader at tier 2 to beat default 2-phase and 3-phase bosses in 8 to 12 beats', () => {
    const tier2 = GEAR_TIERS[1];

    const boss2 = makeBoss(2);
    const care2 = simulate(boss2, tier2, carefulPolicy);
    expect(care2.outcome).toBe('victory');
    expect(care2.beats).toBeGreaterThanOrEqual(8);
    expect(care2.beats).toBeLessThanOrEqual(12);

    const boss3 = makeBoss(3);
    const care3 = simulate(boss3, tier2, carefulPolicy);
    expect(care3.outcome).toBe('victory');
    expect(care3.beats).toBeGreaterThanOrEqual(8);
    expect(care3.beats).toBeLessThanOrEqual(12);

    // Autopilot outcomes at tiers 1, 2, 3 match spec table (defeated across all tiers)
    for (const gear of GEAR_TIERS) {
      expect(simulate(boss2, gear, autopilotPolicy).outcome).toBe('defeat');
      expect(simulate(boss3, gear, autopilotPolicy).outcome).toBe('defeat');
    }
  });

  it('keeps each rule-break winnable on careful play at tier 2', () => {
    const tier2 = GEAR_TIERS[1];

    const unblockable = makeBoss(2, {
      ruleBreak: { type: 'unblockableHeavyWithoutItem', item: 'iron_key' },
    });
    expect(
      simulate(unblockable, tier2, carefulPolicy, {
        storyState: { ...EMPTY_STORY_STATE, items: ['iron_key'] },
      }).outcome,
    ).toBe('victory');

    const hiddenTells = makeBoss(2, {
      ruleBreak: { type: 'hiddenTellsUntilFlag', flag: 'knows_weakness' },
    });
    expect(
      simulate(hiddenTells, tier2, carefulPolicy, {
        storyState: { ...EMPTY_STORY_STATE, flags: { knows_weakness: true } },
      }).outcome,
    ).toBe('victory');

    const healthFloor = makeBoss(2, {
      ruleBreak: { type: 'healthFloorUntilMoment', floor: 8, momentIndex: 0 },
      moments: [
        {
          trigger: { enemyHealthAtMost: 8 },
          caption: 'The barrier shatters.',
          choices: [
            { label: 'Finish it.', then: 'continue' },
            { label: 'Stand ready.', then: 'continue' },
          ],
        },
      ],
    });
    expect(simulate(healthFloor, tier2, carefulPolicy).outcome).toBe('victory');
  });
});
