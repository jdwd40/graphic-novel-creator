import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GEAR_TIERS } from '../../combat/constants';
import {
  advanceBeat,
  getActiveMoment,
  getUpcomingMove,
  resolveMomentChoice,
  startFight,
} from '../../combat/resolver';
import type { Encounter, PlayerCombatState } from '../../combat/types';
import { CombatScreen } from '../../player/CombatScreen';

function makePlayer(damage = 3): PlayerCombatState {
  return {
    health: 12,
    maxHealth: 12,
    weapon: { id: 'w', name: 'Sword', damage },
    armour: { id: 'a', name: 'Mail', buffer: 4 },
    wounds: [],
  };
}

function makeThreePhaseBoss(): Encounter {
  return {
    type: 'encounter',
    enemy: {
      name: 'Bellwarden',
      image: 'bell-p1.png',
      toughness: 'boss',
      health: 16,
      hit: 2,
    },
    behaviour: 'custom',
    pattern: ['strike', 'strike'],
    altPattern: null,
    tellClarity: 'clear',
    phases: [
      { healthAtMost: 12, pattern: ['heavy', 'strike'], image: 'bell-p2.png' },
      { healthAtMost: 6, pattern: ['open', 'heavy'], image: 'bell-p3.png' },
    ],
    moments: [
      {
        trigger: { phaseStart: 1 },
        caption: 'Phase 2 begins.',
        choices: [
          { label: 'Press on', then: 'continue' },
          { label: 'Flee', then: 'exit', exit: 'defeat' },
        ],
      },
      {
        trigger: { phaseStart: 2 },
        caption: 'Phase 3 begins.',
        choices: [
          { label: 'Brace', then: 'continue' },
          { label: 'Yield', then: 'exit', exit: 'defeat' },
        ],
      },
    ],
    allowRetreat: false,
    exits: {
      victory: { effects: [] },
      defeat: { effects: [] },
    },
  };
}

describe('boss phases', () => {
  it('swaps pattern and art on threshold crossing and fires phaseStart moment once', () => {
    const boss = makeThreePhaseBoss();
    let state = startFight(boss, makePlayer(4));
    expect(getUpcomingMove(state)).toBe('strike');

    // Beat 1: 16 - 4 = 12 (crosses phase 1 threshold <=12)
    const b1 = advanceBeat(state, boss, 'steady');
    state = b1.state;
    expect(state.phase).toBe(1);
    expect(state.activePattern).toEqual(['heavy', 'strike']);
    expect(state.patternIndex).toBe(0);
    expect(getUpcomingMove(state)).toBe('heavy');
    expect(state.pendingMomentQueue).toEqual([0]);
    expect(getActiveMoment(state, boss)?.moment.caption).toBe('Phase 2 begins.');

    // Art changes to phase 2 art on CombatScreen
    render(
      <CombatScreen
        encounter={boss}
        fightState={state}
        resultCaption="Phase shift"
        onAdvanceBeat={() => {}}
        onSelectTactic={() => {}}
        onRetreat={() => {}}
      />,
    );
    expect(screen.getByRole('img', { name: 'Bellwarden' })).toHaveAttribute('src', 'bell-p2.png');

    state = resolveMomentChoice(state, boss, 0).state;
    expect(state.firedMoments).toEqual([0]);
  });

  it('lands in the later phase and fires both phaseStart moments in order when crossing two thresholds at once', () => {
    const boss = makeThreePhaseBoss();
    // Start enemy at 13 HP and hit with Press on Open? Or high weapon damage 8 -> 13 - 8 = 5 (crosses <=12 AND <=6!)
    let state = startFight(boss, makePlayer(8));
    state = { ...state, enemyHealth: 13 };

    const step = advanceBeat(state, boss, 'steady');
    state = step.state;
    expect(state.enemyHealth).toBe(5);
    expect(state.phase).toBe(2);
    expect(state.activePattern).toEqual(['open', 'heavy']);
    expect(state.pendingMomentQueue).toEqual([0, 1]);
    expect(getActiveMoment(state, boss)?.moment.caption).toBe('Phase 2 begins.');

    state = resolveMomentChoice(state, boss, 0).state;
    expect(getActiveMoment(state, boss)?.moment.caption).toBe('Phase 3 begins.');
    state = resolveMomentChoice(state, boss, 0).state;
    expect(state.pendingMomentQueue).toEqual([]);
  });

  it('behaves identically when phases is empty', () => {
    const standard: Encounter = {
      ...makeThreePhaseBoss(),
      phases: [],
      moments: [],
    };
    const state = advanceBeat(startFight(standard, makePlayer(GEAR_TIERS[1].damage)), standard, 'steady').state;
    expect(state.phase).toBe(0);
    expect(state.activePattern).toEqual(['strike', 'strike']);
  });
});
