import { describe, expect, it } from 'vitest';
import {
  BUILTIN_VAGUE_TELL_CAPTIONS,
  nextTell,
  selectResultCaption,
} from '../captions';
import { BEHAVIOUR_PRESETS, GEAR_TIERS, TOUGHNESS_PRESETS } from '../constants';
import { advanceBeat, startFight } from '../resolver';
import type { Encounter, PlayerCombatState } from '../types';

function makePlayer(): PlayerCombatState {
  const t1 = GEAR_TIERS[0];
  return {
    health: 6,
    maxHealth: 6,
    weapon: { id: 'rusty_sword', name: t1.weaponName, damage: t1.damage },
    armour: { id: 'padded_coat', name: t1.armourName, buffer: t1.buffer },
    wounds: [],
  };
}

function makeEncounter(overrides: Partial<Encounter> = {}): Encounter {
  const std = TOUGHNESS_PRESETS.standard;
  return {
    type: 'encounter',
    enemy: {
      name: 'Watchman',
      image: 'watchman.png',
      toughness: 'standard',
      health: std.health,
      hit: std.hit,
    },
    behaviour: 'brawler',
    pattern: [...BEHAVIOUR_PRESETS.brawler],
    altPattern: null,
    tellClarity: 'clear',
    allowRetreat: true,
    exits: {
      victory: { effects: [] },
      defeat: { effects: [] },
      retreat: { effects: [] },
    },
    ...overrides,
  };
}

describe('tells and caption selection', () => {
  it('produces a result caption and tell on every beat with built-in pools without back-to-back repeats', () => {
    const encounter = makeEncounter({
      pattern: ['strike', 'strike', 'strike'],
      tellClarity: 'clear',
    });
    let state = startFight(encounter, makePlayer());
    const tells: Array<string | null> = [];
    const results: string[] = [];

    for (let i = 0; i < 3; i++) {
      const tell = nextTell(state, encounter);
      expect(tell.caption).toBeTruthy();
      expect(tell.showIcon).toBe(true);
      tells.push(tell.caption);

      const step = advanceBeat(state, encounter, 'steady');
      const resultCaption = selectResultCaption(
        step.events,
        'steady',
        encounter,
        step.state.beatNumber,
      );
      expect(resultCaption).toBeTruthy();
      results.push(resultCaption);
      state = step.state;
    }

    expect(tells[0]).not.toBe(tells[1]);
    expect(tells[1]).not.toBe(tells[2]);
    expect(results[0]).not.toBe(results[1]);
  });

  it('sets showIcon for clear only, omits icon for vague, and returns nothing for hidden', () => {
    const clearEnc = makeEncounter({ tellClarity: 'clear' });
    const vagueEnc = makeEncounter({ tellClarity: 'vague' });
    const hiddenEnc = makeEncounter({ tellClarity: 'hidden' });

    const sClear = startFight(clearEnc, makePlayer());
    const sVague = startFight(vagueEnc, makePlayer());
    const sHidden = startFight(hiddenEnc, makePlayer());

    expect(nextTell(sClear, clearEnc)).toMatchObject({ clarity: 'clear', showIcon: true });
    expect(nextTell(sVague, vagueEnc)).toMatchObject({ clarity: 'vague', showIcon: false });
    expect(nextTell(sHidden, hiddenEnc)).toEqual({
      move: 'strike',
      clarity: 'hidden',
      caption: null,
      showIcon: false,
    });
  });

  it('never names the move in built-in vague captions', () => {
    const forbidden = /\b(strike|heavy|open|guard|press|steady)\b/i;
    for (const pool of Object.values(BUILTIN_VAGUE_TELL_CAPTIONS)) {
      for (const line of pool) {
        expect(line).not.toMatch(forbidden);
      }
    }
  });

  it('uses custom captions from the spec example encounter at the right beats', () => {
    const brute = makeEncounter({
      enemy: {
        name: 'Hammer Brute',
        image: 'brute.png',
        toughness: 'tough',
        health: 12,
        hit: 2,
      },
      behaviour: 'brute',
      pattern: ['strike', 'heavy'],
      tellClarity: 'vague',
      captions: {
        tell: { heavy: ['The creature shifts its weight.'] },
        result: { heavyBlocked: ['The hammer crashes into the floor and sticks there.'] },
      },
    });

    const state0 = startFight(brute, makePlayer());
    // Beat 1 is strike -> Beat 2 is heavy.
    const beat1 = advanceBeat(state0, brute, 'steady');
    const tellBeforeHeavy = nextTell(beat1.state, brute);
    expect(tellBeforeHeavy.move).toBe('heavy');
    expect(tellBeforeHeavy.caption).toBe('The creature shifts its weight.');

    // Guarding the heavy produces the custom heavyBlocked result caption and Open tell next.
    const beat2 = advanceBeat(beat1.state, brute, 'guard');
    const resultCaption = selectResultCaption(
      beat2.events,
      'guard',
      brute,
      beat2.state.beatNumber,
    );
    expect(resultCaption).toBe('The hammer crashes into the floor and sticks there.');
    expect(nextTell(beat2.state, brute).move).toBe('open');
  });

  it('produces identical captions when replaying the same fight', () => {
    const encounter = makeEncounter();
    const runOnce = () => {
      let state = startFight(encounter, makePlayer());
      const log: string[] = [];
      while (state.status === 'ongoing') {
        const tell = nextTell(state, encounter);
        const step = advanceBeat(state, encounter, 'steady');
        const res = selectResultCaption(step.events, 'steady', encounter, step.state.beatNumber);
        log.push(`${tell.caption ?? ''} -> ${res}`);
        state = step.state;
      }
      return log;
    };

    expect(runOnce()).toEqual(runOnce());
  });
});
