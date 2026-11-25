import { describe, expect, it } from 'vitest';
import {
  BASE_PLAYER_HEALTH,
  BEHAVIOUR_PRESETS,
  GEAR_TIERS,
  TOUGHNESS_PRESETS,
} from '../constants';
import { advanceBeat, finishFight, retreatFight, startFight } from '../resolver';
import type { Encounter, PlayerCombatState } from '../types';

function createTier1Player(health = BASE_PLAYER_HEALTH): PlayerCombatState {
  const tier1 = GEAR_TIERS[0];
  return {
    health,
    maxHealth: BASE_PLAYER_HEALTH,
    weapon: { id: 'rusty_sword', name: tier1.weaponName, damage: tier1.damage },
    armour: { id: 'padded_coat', name: tier1.armourName, buffer: tier1.buffer },
    wounds: [],
  };
}

function createPresetEncounter(
  toughness: 'weak' | 'standard' | 'tough',
  behaviour: 'brawler' | 'brute' | 'skirmisher',
  allowRetreat = true,
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
    allowRetreat,
    exits: {
      victory: { effects: [] },
      defeat: { effects: [] },
      retreat: { effects: [] },
    },
  };
}

describe('fight lifecycle and exits', () => {
  it('wins Standard Brawler on Steady with tier 1 gear on beat 4 with 2 health lost', () => {
    const encounter = createPresetEncounter('standard', 'brawler');
    let state = startFight(encounter, createTier1Player());

    while (state.status === 'ongoing') {
      state = advanceBeat(state, encounter, 'steady').state;
    }

    const result = finishFight(state, encounter);
    expect(result.exitKey).toBe('victory');
    expect(result.beatsPlayed).toBe(4);
    expect(result.healthLost).toBe(2);
    expect(result.healthAfter).toBe(4);
    expect(result.clean).toBe(false);
    expect(result.bloodied).toBe(false);
    expect(result.bufferDiscarded).toBe(true);
  });

  it('is defeated by Tough Brute on Steady with tier 1 gear on beat 3 and reports health 1', () => {
    const encounter = createPresetEncounter('tough', 'brute');
    let state = startFight(encounter, createTier1Player());

    while (state.status === 'ongoing') {
      state = advanceBeat(state, encounter, 'steady').state;
    }

    const result = finishFight(state, encounter);
    expect(result.exitKey).toBe('defeat');
    expect(result.beatsPlayed).toBe(3);
    expect(result.healthAfter).toBe(1);
    expect(result.bloodied).toBe(true);
  });

  it('costs buffer only when retreating with full buffer, and health when buffer is 0', () => {
    const encounter = createPresetEncounter('tough', 'brute');

    const withBuffer = startFight(encounter, createTier1Player(6));
    const retreatedWithBuffer = retreatFight(withBuffer, encounter).state;
    expect(retreatedWithBuffer.status).toBe('finished');
    expect(retreatedWithBuffer.exitKey).toBe('retreat');
    expect(retreatedWithBuffer.playerBuffer).toBe(0);
    expect(retreatedWithBuffer.playerHealth).toBe(6);

    const noArmourPlayer: PlayerCombatState = {
      ...createTier1Player(6),
      armour: null,
    };
    const withoutBuffer = startFight(encounter, noArmourPlayer);
    const retreatedNoBuffer = retreatFight(withoutBuffer, encounter).state;
    expect(retreatedNoBuffer.exitKey).toBe('retreat');
    expect(retreatedNoBuffer.playerHealth).toBe(4);
  });

  it('leaves by Defeat if the free Strike on retreat drops player health to 0', () => {
    const encounter = createPresetEncounter('tough', 'brute');
    const lowHpPlayer: PlayerCombatState = {
      ...createTier1Player(2),
      armour: null,
    };
    const state = startFight(encounter, lowHpPlayer);
    const retreated = retreatFight(state, encounter).state;
    expect(retreated.exitKey).toBe('defeat');
    expect(finishFight(retreated, encounter).healthAfter).toBe(1);
  });

  it('refuses retreat when allowRetreat is false', () => {
    const encounter = createPresetEncounter('standard', 'brawler', false);
    const state = startFight(encounter, createTier1Player());
    expect(() => retreatFight(state, encounter)).toThrow(/disabled/i);
  });

  it('records clean and bloodied manner flags accurately', () => {
    const weak = createPresetEncounter('weak', 'skirmisher');
    let cleanState = startFight(weak, createTier1Player(6));
    while (cleanState.status === 'ongoing') {
      cleanState = advanceBeat(cleanState, weak, 'steady').state;
    }
    const cleanResult = finishFight(cleanState, weak);
    expect(cleanResult.clean).toBe(true);
    expect(cleanResult.bloodied).toBe(false);

    const standard = createPresetEncounter('standard', 'brawler');
    let bloodiedState = startFight(standard, createTier1Player(4));
    while (bloodiedState.status === 'ongoing') {
      bloodiedState = advanceBeat(bloodiedState, standard, 'steady').state;
    }
    const bloodiedResult = finishFight(bloodiedState, standard);
    expect(bloodiedResult.healthAfter).toBe(2);
    expect(bloodiedResult.clean).toBe(false);
    expect(bloodiedResult.bloodied).toBe(true);
  });
});
