import { describe, expect, it } from 'vitest';
import { advanceBeat, startFight } from '../resolver';
import type { Encounter, Move, PlayerCombatState } from '../types';

function makeShiftyEncounter(altPattern: Move[] | null = ['heavy', 'open']): Encounter {
  return {
    type: 'encounter',
    enemy: {
      name: 'Shifty Duelist',
      image: 'duelist.png',
      toughness: 'tough',
      health: 30,
      hit: 1,
    },
    behaviour: 'custom',
    pattern: ['strike', 'strike'],
    altPattern,
    tellClarity: 'clear',
    allowRetreat: true,
    exits: {
      victory: { effects: [] },
      defeat: { effects: [] },
      retreat: { effects: [] },
    },
  };
}

function makeHealthyPlayer(): PlayerCombatState {
  return {
    health: 30,
    maxHealth: 30,
    weapon: { id: 'dagger', name: 'Dagger', damage: 1 },
    armour: null,
    wounds: [],
  };
}

function recordPlayedMoves(playthroughId: string, beats = 8): Move[] {
  const enc = makeShiftyEncounter();
  let state = startFight(enc, makeHealthyPlayer(), {
    playthroughId,
    encounterId: 'enc-shifty',
  });
  const moves: Move[] = [];
  for (let i = 0; i < beats; i++) {
    const step = advanceBeat(state, enc, 'steady');
    const moveEvent = step.events.find((e) => e.type === 'enemyMove');
    if (moveEvent?.move) {
      moves.push(moveEvent.move);
    }
    state = step.state;
  }
  return moves;
}

describe('seeded pattern variation for shifty enemies', () => {
  it('always produces the same sequence of patterns for the same seed', () => {
    const runA = recordPlayedMoves('playthrough-alpha');
    const runB = recordPlayedMoves('playthrough-alpha');
    expect(runA).toEqual(runB);
  });

  it('picks both primary and alt patterns across a sample of playthrough ids', () => {
    const firstMoves = new Set<Move>();
    for (let i = 0; i < 20; i++) {
      const moves = recordPlayedMoves(`pt-${i}`, 2);
      firstMoves.add(moves[0]);
    }
    expect(firstMoves.has('strike')).toBe(true);
    expect(firstMoves.has('heavy')).toBe(true);
  });

  it('continues with the exact same pattern when rebuilt mid-fight from saved JSON', () => {
    const enc = makeShiftyEncounter();
    let state = startFight(enc, makeHealthyPlayer(), {
      playthroughId: 'pt-reload',
      encounterId: 'enc-shifty',
    });
    state = advanceBeat(state, enc, 'steady').state;

    const restored = JSON.parse(JSON.stringify(state));
    const resumedNext = advanceBeat(restored, enc, 'steady');
    const directNext = advanceBeat(state, enc, 'steady');
    expect(resumedNext.events).toEqual(directNext.events);
    expect(resumedNext.state.activePattern).toEqual(directNext.state.activePattern);
  });

  it('behaves identically to non-shifty when altPattern is null', () => {
    const enc = makeShiftyEncounter(null);
    let state = startFight(enc, makeHealthyPlayer(), {
      playthroughId: 'pt-any',
      encounterId: 'enc-1',
    });
    const moves: Move[] = [];
    for (let i = 0; i < 6; i++) {
      const step = advanceBeat(state, enc, 'steady');
      moves.push(step.events.find((e) => e.type === 'enemyMove')!.move!);
      state = step.state;
    }
    expect(moves).toEqual(['strike', 'strike', 'strike', 'strike', 'strike', 'strike']);
  });
});
