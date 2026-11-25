import { describe, expect, it } from 'vitest';
import {
  BASE_PLAYER_HEALTH,
  BARE_HANDS_DAMAGE,
  BEHAVIOUR_PRESETS,
  GEAR_TIERS,
  NO_ARMOUR_BUFFER,
  TOUGHNESS_PRESETS,
  validateEncounterJson,
} from '../index';

const specExampleEncounter = {
  type: 'encounter',
  enemy: {
    name: 'Hammer Brute',
    image: 'brute.png',
    toughness: 'tough',
    health: 12,
    hit: 2,
  },
  behaviour: 'brute',
  pattern: ['strike', 'heavy'],
  altPattern: null,
  tellClarity: 'vague',
  captions: {
    tell: { heavy: ['The creature shifts its weight.'] },
    result: { heavyBlocked: ['The hammer crashes into the floor and sticks there.'] },
  },
  art: { open: 'brute-stuck.png' },
  modifiers: [
    { if: { flag: 'sabotaged_robot' }, effect: 'enemyHealth', value: -3 },
    { if: { flag: 'knows_weakness' }, effect: 'revealTells' },
    {
      if: { flag: 'rescued_mira' },
      effect: 'allyActs',
      beat: 3,
      damage: 2,
      caption: 'Mira drives her knife into its flank.',
    },
  ],
  moments: [
    {
      trigger: { enemyHealthAtMost: 3 },
      caption: 'The brute falls to one knee.',
      choices: [
        { label: 'Finish it.', then: 'continue' },
        { label: 'Demand surrender.', then: 'exit', exit: 'surrender' },
      ],
    },
  ],
  phases: [],
  winCondition: { type: 'enemyHealthZero' },
  allowRetreat: true,
  exits: {
    victory: { effects: [] },
    defeat: { effects: [{ removeItem: 'steel_sword' }, { addWound: 'Cracked rib' }] },
    retreat: { effects: [] },
    surrender: { label: 'Surrender', effects: [{ setFlag: 'brute_spared' }] },
  },
};

describe('combat presets and validation', () => {
  it('validates the example encounter from the spec', () => {
    const result = validateEncounterJson(specExampleEncounter);
    expect(result.valid).toBe(true);
  });

  it('rejects unknown move name, empty pattern, and missing enemy name with field names', () => {
    const unknownMove = validateEncounterJson({
      ...specExampleEncounter,
      pattern: ['strike', 'kick'],
    });
    expect(unknownMove.valid).toBe(false);
    if (!unknownMove.valid) {
      expect(unknownMove.errors.some((e) => e.includes('pattern[1]') && e.includes('kick'))).toBe(
        true,
      );
    }

    const emptyPattern = validateEncounterJson({
      ...specExampleEncounter,
      pattern: [],
    });
    expect(emptyPattern.valid).toBe(false);
    if (!emptyPattern.valid) {
      expect(emptyPattern.errors.some((e) => e.includes('pattern'))).toBe(true);
    }

    const missingName = validateEncounterJson({
      ...specExampleEncounter,
      enemy: { ...specExampleEncounter.enemy, name: '' },
    });
    expect(missingName.valid).toBe(false);
    if (!missingName.valid) {
      expect(missingName.errors.some((e) => e.includes('enemy.name'))).toBe(true);
    }
  });

  it('matches every preset and constant in the spec tables', () => {
    expect(TOUGHNESS_PRESETS.weak).toEqual({ health: 5, hit: 1, tellClarity: 'clear' });
    expect(TOUGHNESS_PRESETS.standard).toEqual({ health: 8, hit: 1, tellClarity: 'clear' });
    expect(TOUGHNESS_PRESETS.tough).toEqual({ health: 12, hit: 2, tellClarity: 'vague' });
    expect(TOUGHNESS_PRESETS.boss).toEqual({ health: 16, hit: 2, tellClarity: 'vague' });

    expect(BEHAVIOUR_PRESETS.brawler).toEqual(['strike', 'strike', 'heavy']);
    expect(BEHAVIOUR_PRESETS.brute).toEqual(['strike', 'heavy']);
    expect(BEHAVIOUR_PRESETS.skirmisher).toEqual(['strike', 'strike', 'strike', 'open']);

    expect(GEAR_TIERS.map((g) => [g.damage, g.buffer])).toEqual([
      [2, 2],
      [3, 4],
      [4, 6],
    ]);

    expect(BASE_PLAYER_HEALTH).toBe(6);
    expect(BARE_HANDS_DAMAGE).toBe(1);
    expect(NO_ARMOUR_BUFFER).toBe(0);
  });
});
