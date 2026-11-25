import { describe, expect, it } from 'vitest';
import {
  BEHAVIOUR_PRESETS,
  GEAR_TIERS,
  TOUGHNESS_PRESETS,
} from '../constants';
import {
  autopilotPolicy,
  carefulPolicy,
  guardHeavyPolicy,
  simulate,
  simulateAcrossTiers,
} from '../simulator';
import type { BehaviourPreset, Encounter, ToughnessPreset } from '../types';

function createEncounter(
  toughness: ToughnessPreset,
  behaviour: Exclude<BehaviourPreset, 'custom'>,
): Encounter {
  const t = TOUGHNESS_PRESETS[toughness];
  return {
    type: 'encounter',
    enemy: {
      name: `${toughness} ${behaviour}`,
      image: 'enemy.png',
      toughness,
      health: t.health,
      hit: t.hit,
    },
    behaviour,
    pattern: [...BEHAVIOUR_PRESETS[behaviour]],
    altPattern: null,
    tellClarity: t.tellClarity,
    allowRetreat: true,
    exits: {
      victory: { effects: [] },
      defeat: { effects: [] },
      retreat: { effects: [] },
    },
  };
}

describe('simulation runner regression suite', () => {
  const tier1 = GEAR_TIERS[0];
  const tier2 = GEAR_TIERS[1];

  it('Weak Skirmisher, tier 1: both readers win in 3 beats with no health lost', () => {
    const enc = createEncounter('weak', 'skirmisher');
    const auto = simulate(enc, tier1, autopilotPolicy);
    const care = simulate(enc, tier1, carefulPolicy);

    expect(auto).toMatchObject({ outcome: 'victory', beats: 3, healthLost: 0 });
    expect(care).toMatchObject({ outcome: 'victory', beats: 3, healthLost: 0 });
  });

  it('Standard Brawler, tier 1: autopilot wins in 4 beats (-2 HP), careful wins in 4 beats (-0 HP)', () => {
    const enc = createEncounter('standard', 'brawler');
    const auto = simulate(enc, tier1, autopilotPolicy);
    const care = simulate(enc, tier1, carefulPolicy);

    expect(auto).toMatchObject({ outcome: 'victory', beats: 4, healthLost: 2 });
    expect(care).toMatchObject({ outcome: 'victory', beats: 4, healthLost: 0 });
  });

  it('Tough Brute, tier 1: autopilot defeated on beat 3, careful wins in 6 beats (-2 HP)', () => {
    const enc = createEncounter('tough', 'brute');
    const auto = simulate(enc, tier1, autopilotPolicy);
    const care = simulate(enc, tier1, carefulPolicy);

    expect(auto).toMatchObject({ outcome: 'defeat', beats: 3 });
    expect(care).toMatchObject({ outcome: 'victory', beats: 6, healthLost: 2 });
  });

  it('Tough Brute, tier 2: autopilot wins in 4 beats (-4 HP), careful wins in 4 beats (-0 HP)', () => {
    const enc = createEncounter('tough', 'brute');
    const auto = simulate(enc, tier2, autopilotPolicy);
    const care = simulate(enc, tier2, carefulPolicy);

    expect(auto).toMatchObject({ outcome: 'victory', beats: 4, healthLost: 4 });
    expect(care).toMatchObject({ outcome: 'victory', beats: 4, healthLost: 0 });
  });

  it('Guard-everything-but-Open against Tough Brute at tier 1 wins in 9 beats and loses 1 health', () => {
    const enc = createEncounter('tough', 'brute');
    const guardHeavy = simulate(enc, tier1, guardHeavyPolicy);

    expect(guardHeavy).toMatchObject({ outcome: 'victory', beats: 9, healthLost: 1 });
  });

  it('stops at 40 beats and reports stall when neither side can finish', () => {
    const enc = {
      ...createEncounter('tough', 'brute'),
      pattern: ['heavy' as const],
    };
    const stalled = simulate(enc, GEAR_TIERS[0], () => 'guard');
    expect(stalled.outcome).toBe('stall');
    expect(stalled.beats).toBe(40);
  });

  it('simulates across all example gear tiers', () => {
    const enc = createEncounter('standard', 'brawler');
    const rows = simulateAcrossTiers(enc);
    expect(rows).toHaveLength(3);
    expect(rows[0].tier).toBe(1);
    expect(rows[1].tier).toBe(2);
    expect(rows[2].tier).toBe(3);
  });
});
