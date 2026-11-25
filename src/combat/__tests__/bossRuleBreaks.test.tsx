import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { nextTell } from '../../combat/captions';
import { EMPTY_STORY_STATE } from '../../combat/conditions';
import { advanceBeat, resolveMomentChoice, startFight } from '../../combat/resolver';
import { carefulPolicy, simulate } from '../../combat/simulator';
import type { Encounter, PlayerCombatState } from '../../combat/types';
import { BossEditor } from '../../builder/BossEditor';
import { createDefaultEncounterNode } from '../../builder/graphUtils';

function makePlayer(): PlayerCombatState {
  return {
    health: 12,
    maxHealth: 12,
    weapon: { id: 'steel', name: 'Steel Sword', damage: 3 },
    armour: { id: 'mail', name: 'Mail', buffer: 4 },
    wounds: [],
  };
}

function makeBoss(overrides: Partial<Encounter> = {}): Encounter {
  return {
    type: 'encounter',
    enemy: {
      name: 'Warden',
      image: 'warden.png',
      toughness: 'boss',
      health: 16,
      hit: 2,
    },
    behaviour: 'custom',
    pattern: ['heavy', 'strike'],
    altPattern: null,
    tellClarity: 'clear',
    allowRetreat: false,
    exits: {
      victory: { effects: [] },
      defeat: { effects: [] },
    },
    ...overrides,
  };
}

describe('boss rule-breaks and other win conditions', () => {
  it('enforces unblockable Heavy without the named item, and blocks normally with it', () => {
    const boss = makeBoss({
      ruleBreak: { type: 'unblockableHeavyWithoutItem', item: 'iron_key' },
    });

    const withoutItem = startFight(boss, makePlayer(), { storyState: EMPTY_STORY_STATE });
    const stepUnblocked = advanceBeat(withoutItem, boss, 'guard');
    expect(stepUnblocked.state.pendingOpen).toBe(false);
    // Takes full Heavy damage = 2*H = 4 -> buffer 4 drops to 0
    expect(stepUnblocked.state.playerBuffer).toBe(0);

    const withItem = startFight(boss, makePlayer(), {
      storyState: { ...EMPTY_STORY_STATE, items: ['iron_key'] },
    });
    const stepBlocked = advanceBeat(withItem, boss, 'guard');
    expect(stepBlocked.state.pendingOpen).toBe(true);
    expect(stepBlocked.state.playerBuffer).toBe(4);
    expect(stepBlocked.events).toContainEqual({
      type: 'heavyBlocked',
      move: 'heavy',
      tactic: 'guard',
    });
  });

  it('keeps tells hidden until the required flag is set', () => {
    const boss = makeBoss({
      tellClarity: 'clear',
      ruleBreak: { type: 'hiddenTellsUntilFlag', flag: 'knows_weakness' },
    });

    const hiddenState = startFight(boss, makePlayer(), { storyState: EMPTY_STORY_STATE });
    expect(nextTell(hiddenState, boss)).toMatchObject({ clarity: 'hidden', caption: null });

    const revealedState = startFight(boss, makePlayer(), {
      storyState: { ...EMPTY_STORY_STATE, flags: { knows_weakness: true } },
    });
    expect(nextTell(revealedState, boss)).toMatchObject({ clarity: 'clear', showIcon: true });
  });

  it('ends a survive-6-beats fight in Victory after beat 6 if the player is alive', () => {
    const boss = makeBoss({
      enemy: { name: 'Endless Tide', image: 'tide.png', toughness: 'boss', health: 50, hit: 1 },
      pattern: ['strike'],
      winCondition: { type: 'surviveBeats', beats: 6 },
    });

    const sim = simulate(boss, { damage: 2, buffer: 4 }, carefulPolicy);
    expect(sim.outcome).toBe('victory');
    expect(sim.beats).toBe(6);
  });

  it('holds enemy health floor until its moment resolves, then releases', () => {
    const boss = makeBoss({
      enemy: { name: 'Undying', image: 'u.png', toughness: 'boss', health: 8, hit: 1 },
      pattern: ['strike', 'strike'],
      ruleBreak: { type: 'healthFloorUntilMoment', floor: 4, momentIndex: 0 },
      moments: [
        {
          trigger: { beat: 2 },
          caption: 'The anchor chain snaps!',
          choices: [
            { label: 'Press the attack', then: 'continue' },
            { label: 'Step back', then: 'continue' },
          ],
        },
      ],
    });

    let state = startFight(boss, makePlayer());
    // Beat 1: 8 - 3 = 5
    state = advanceBeat(state, boss, 'steady').state;
    expect(state.enemyHealth).toBe(5);
    // Beat 2: 5 - 3 = 2, clamped at floor 4; moment 0 opens
    state = advanceBeat(state, boss, 'steady').state;
    expect(state.enemyHealth).toBe(4);
    expect(state.pendingMomentQueue).toEqual([0]);

    // Resolve moment -> releases floor
    state = resolveMomentChoice(state, boss, 0).state;
    expect(state.releasedHealthFloor).toBe(true);

    // Beat 3 & 4 drop health below 4 to 0 -> Victory
    state = advanceBeat(state, boss, 'steady').state;
    expect(state.enemyHealth).toBe(1);
    state = advanceBeat(state, boss, 'steady').state;
    expect(state.enemyHealth).toBe(0);
    expect(state.status).toBe('finished');
    expect(state.exitKey).toBe('victory');
  });

  it('refuses adding a second rule-break in the BossEditor inspector', () => {
    function Harness() {
      const [enc, setEnc] = useState<Encounter>(() => ({
        ...createDefaultEncounterNode('b1').encounter,
        ruleBreak: { type: 'hiddenTellsUntilFlag', flag: 'knows_weakness' },
      }));
      return <BossEditor encounter={enc} onUpdate={setEnc} />;
    }

    render(<Harness />);
    fireEvent.click(screen.getByText(/Boss phases & rules/i));
    fireEvent.click(screen.getByRole('button', { name: /add rule-break/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/only one rule-break/i);
  });
});
