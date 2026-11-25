import { describe, expect, it } from 'vitest';
import { EMPTY_STORY_STATE } from '../conditions';
import { GEAR_TIERS } from '../constants';
import {
  advanceBeat,
  getActiveMoment,
  getAvailableMomentChoices,
  resolveMomentChoice,
  startFight,
} from '../resolver';
import type { Encounter, PlayerCombatState } from '../types';

function makePlayer(damage = 3): PlayerCombatState {
  return {
    health: 6,
    maxHealth: 6,
    weapon: { id: 'w', name: 'Weapon', damage },
    armour: { id: 'a', name: 'Mail', buffer: 4 },
    wounds: [],
  };
}

function makeBruteWithMoment(): Encounter {
  return {
    type: 'encounter',
    enemy: { name: 'Hammer Brute', image: 'brute.png', toughness: 'tough', health: 12, hit: 2 },
    behaviour: 'brute',
    pattern: ['strike', 'strike'],
    altPattern: null,
    tellClarity: 'clear',
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
    allowRetreat: true,
    exits: {
      victory: { effects: [] },
      defeat: { effects: [] },
      retreat: { effects: [] },
      surrender: { label: 'Surrender', effects: [{ setFlag: 'brute_spared' }] },
    },
  };
}

describe('moments: triggers and choices in the engine', () => {
  it('fires the spec example moment at enemyHealth <= 3, blocks beat advance, and never fires twice', () => {
    const enc = makeBruteWithMoment();
    let state = startFight(enc, makePlayer(3));

    // Beat 1: 12 -> 9, Beat 2: 9 -> 6, Beat 3: 6 -> 3 (triggers moment)
    state = advanceBeat(state, enc, 'steady').state;
    expect(state.pendingMomentQueue).toEqual([]);
    state = advanceBeat(state, enc, 'steady').state;
    expect(state.pendingMomentQueue).toEqual([]);
    const beat3 = advanceBeat(state, enc, 'steady');
    state = beat3.state;

    expect(state.enemyHealth).toBe(3);
    expect(state.pendingMomentQueue).toEqual([0]);
    expect(state.firedMoments).toEqual([0]);
    expect(getActiveMoment(state, enc)?.moment.caption).toBe('The brute falls to one knee.');

    // Cannot resolve a beat while moment is open
    expect(() => advanceBeat(state, enc, 'steady')).toThrow(/moment is open/i);

    // Choose "Finish it." -> continues fight, never fires again
    state = resolveMomentChoice(state, enc, 0).state;
    expect(state.pendingMomentQueue).toEqual([]);
    expect(state.status).toBe('ongoing');

    const finalBeat = advanceBeat(state, enc, 'steady').state;
    expect(finalBeat.status).toBe('finished');
    expect(finalBeat.exitKey).toBe('victory');
    expect(finalBeat.firedMoments).toEqual([0]);
  });

  it('leaves by the surrender exit when "Demand surrender." is chosen', () => {
    const enc = makeBruteWithMoment();
    let state = startFight(enc, makePlayer(3));
    state = advanceBeat(state, enc, 'steady').state;
    state = advanceBeat(state, enc, 'steady').state;
    state = advanceBeat(state, enc, 'steady').state;

    const exited = resolveMomentChoice(state, enc, 1).state;
    expect(exited.status).toBe('finished');
    expect(exited.exitKey).toBe('surrender');
  });

  it('skips firing a moment when a killing blow drops enemy health past the threshold to 0', () => {
    const enc = makeBruteWithMoment();
    let state = startFight(enc, makePlayer(4));
    // 12 -> 8 -> 4 -> 0 (killing blow skips <=3 threshold without firing moment)
    state = advanceBeat(state, enc, 'steady').state;
    state = advanceBeat(state, enc, 'steady').state;
    const killBeat = advanceBeat(state, enc, 'steady').state;

    expect(killBeat.status).toBe('finished');
    expect(killBeat.exitKey).toBe('victory');
    expect(killBeat.firedMoments).toEqual([]);
    expect(killBeat.pendingMomentQueue).toEqual([]);
  });

  it('filters locked/conditional choices and reveals them only when unlocked or satisfied', () => {
    const enc: Encounter = {
      ...makeBruteWithMoment(),
      modifiers: [{ if: { flag: 'diplomat' }, effect: 'unlockChoice', choiceId: 'parley' }],
      moments: [
        {
          trigger: { beat: 1 },
          caption: 'A pause between blows.',
          choices: [
            { label: 'Keep fighting', then: 'continue' },
            { label: 'Parley', then: 'exit', exit: 'surrender', requiresUnlock: 'parley' },
            {
              label: 'Show badge',
              then: 'exit',
              exit: 'surrender',
              condition: { item: 'watch_badge' },
            },
          ],
        },
      ],
    };

    const lockedState = advanceBeat(
      startFight(enc, makePlayer(GEAR_TIERS[0].damage), { storyState: EMPTY_STORY_STATE }),
      enc,
      'steady',
    ).state;
    const lockedChoices = getAvailableMomentChoices(lockedState, enc, EMPTY_STORY_STATE);
    expect(lockedChoices.map((c) => c.choice.label)).toEqual(['Keep fighting']);

    const unlockedStory = {
      flags: { diplomat: true },
      items: ['watch_badge'],
      stats: {},
    };
    const unlockedState = advanceBeat(
      startFight(enc, makePlayer(GEAR_TIERS[0].damage), { storyState: unlockedStory }),
      enc,
      'steady',
    ).state;
    const unlockedChoices = getAvailableMomentChoices(unlockedState, enc, unlockedStory);
    expect(unlockedChoices.map((c) => c.choice.label)).toEqual([
      'Keep fighting',
      'Parley',
      'Show badge',
    ]);
  });

  it('queues two moments due on the same beat in list order', () => {
    const enc: Encounter = {
      ...makeBruteWithMoment(),
      moments: [
        {
          trigger: { beat: 1 },
          caption: 'First moment',
          choices: [
            { label: 'Continue 1', then: 'continue' },
            { label: 'Retreat', then: 'exit', exit: 'retreat' },
          ],
        },
        {
          trigger: { enemyHealthAtMost: 10 },
          caption: 'Second moment',
          choices: [
            { label: 'Continue 2', then: 'continue' },
            { label: 'Surrender', then: 'exit', exit: 'surrender' },
          ],
        },
      ],
    };

    // Beat 1 deals 3 -> enemy health 9 (<=10) AND beat === 1
    let state = advanceBeat(startFight(enc, makePlayer(3)), enc, 'steady').state;
    expect(state.pendingMomentQueue).toEqual([0, 1]);
    expect(getActiveMoment(state, enc)?.moment.caption).toBe('First moment');

    state = resolveMomentChoice(state, enc, 0).state;
    expect(state.pendingMomentQueue).toEqual([1]);
    expect(getActiveMoment(state, enc)?.moment.caption).toBe('Second moment');

    state = resolveMomentChoice(state, enc, 0).state;
    expect(state.pendingMomentQueue).toEqual([]);
  });
});
