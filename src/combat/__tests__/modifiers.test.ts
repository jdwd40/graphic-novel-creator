import { describe, expect, it } from 'vitest';
import { nextTell } from '../captions';
import { EMPTY_STORY_STATE } from '../conditions';
import { GEAR_TIERS } from '../constants';
import { advanceBeat, startFight } from '../resolver';
import { autopilotPolicy, simulate } from '../simulator';
import type { Encounter, PlayerCombatState } from '../types';

function makeSpecBrute(): Encounter {
  return {
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
    allowRetreat: true,
    exits: {
      victory: { effects: [] },
      defeat: { effects: [] },
      retreat: { effects: [] },
    },
  };
}

function makeTier1Player(): PlayerCombatState {
  const t1 = GEAR_TIERS[0];
  return {
    health: 6,
    maxHealth: 6,
    weapon: { id: 'w1', name: t1.weaponName, damage: t1.damage },
    armour: { id: 'a1', name: t1.armourName, buffer: t1.buffer },
    wounds: [],
  };
}

describe('modifiers applied at fight start', () => {
  it('starts the spec example at 9 health when sabotaged_robot is set', () => {
    const enc = makeSpecBrute();
    const state = startFight(enc, makeTier1Player(), {
      storyState: { ...EMPTY_STORY_STATE, flags: { sabotaged_robot: true } },
    });
    expect(state.enemyHealth).toBe(9);
    expect(state.enemyMaxHealth).toBe(9);
  });

  it('reveals all tells as clear with icon when knows_weakness is set', () => {
    const enc = makeSpecBrute();
    const state = startFight(enc, makeTier1Player(), {
      storyState: { ...EMPTY_STORY_STATE, flags: { knows_weakness: true } },
    });
    const tell = nextTell(state, enc);
    expect(tell.clarity).toBe('clear');
    expect(tell.showIcon).toBe(true);
  });

  it('deals 2 extra damage on beat 3 before player hit and emits ally caption when rescued_mira is set', () => {
    const enc = makeSpecBrute();
    let state = startFight(enc, makeTier1Player(), {
      storyState: { ...EMPTY_STORY_STATE, flags: { rescued_mira: true } },
    });

    // Beat 1 & 2 on Guard/Steady (keep player alive)
    state = advanceBeat(state, enc, 'steady').state; // 12 - 2 = 10
    state = advanceBeat(state, enc, 'guard').state; // heavy blocked -> 10
    // Beat 3 (Open): Mira deals 2 before player's Press (2*2=4) -> 10 - 2 - 4 = 4
    const beat3 = advanceBeat(state, enc, 'press');
    expect(beat3.state.enemyHealth).toBe(4);
    expect(beat3.events).toContainEqual({
      type: 'allyActed',
      amount: 2,
      caption: 'Mira drives her knife into its flank.',
    });
  });

  it('does nothing when modifier condition fails and clamps enemy health floor at 1', () => {
    const enc: Encounter = {
      ...makeSpecBrute(),
      modifiers: [
        { if: { flag: 'not_set' }, effect: 'enemyHealth', value: -5 },
        { if: { flag: 'nuke' }, effect: 'enemyHealth', value: -999 },
        { if: { flag: 'nuke' }, effect: 'enemyHit', value: -99 },
      ],
    };

    const unaffected = startFight(enc, makeTier1Player(), { storyState: EMPTY_STORY_STATE });
    expect(unaffected.enemyHealth).toBe(12);

    const clamped = startFight(enc, makeTier1Player(), {
      storyState: { ...EMPTY_STORY_STATE, flags: { nuke: true } },
    });
    expect(clamped.enemyHealth).toBe(1);
    expect(clamped.enemyHit).toBe(0);
  });

  it('supports bonusBuffer, swapPattern, unlockChoice, unlockExit, and simulator storyState', () => {
    const enc: Encounter = {
      ...makeSpecBrute(),
      modifiers: [
        { if: { flag: 'sabotaged_robot' }, effect: 'enemyHealth', value: -3 },
        { if: { flag: 'high_ground' }, effect: 'bonusBuffer', value: 2 },
        { if: { item: 'charm' }, effect: 'swapPattern', pattern: ['open'] },
        { if: { flag: 'talk' }, effect: 'unlockChoice', choiceId: 'diplomacy' },
        { if: { flag: 'recruit' }, effect: 'unlockExit', exitKey: 'ally' },
      ],
    };

    const state = startFight(enc, makeTier1Player(), {
      storyState: {
        flags: { high_ground: true, talk: true, recruit: true },
        items: ['charm'],
        stats: {},
      },
    });
    expect(state.playerBuffer).toBe(4);
    expect(state.activePattern).toEqual(['open']);
    expect(state.unlockedChoices).toEqual(['diplomacy']);
    expect(state.unlockedExits).toEqual(['ally']);

    const simDefault = simulate(enc, GEAR_TIERS[0], autopilotPolicy);
    expect(simDefault.outcome).toBe('defeat');

    const simWithModifiers = simulate(enc, GEAR_TIERS[0], autopilotPolicy, {
      storyState: {
        flags: { sabotaged_robot: true, high_ground: true },
        items: ['charm'],
        stats: {},
      },
    });
    expect(simWithModifiers.outcome).toBe('victory');
  });
});
