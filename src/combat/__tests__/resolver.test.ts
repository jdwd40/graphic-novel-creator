import { describe, expect, it } from 'vitest';
import { resolveBeat } from '../resolver';
import type { Encounter, FightState, Move, Tactic } from '../types';

function makeEncounter(pattern: Move[] = ['strike', 'heavy'], hit = 2): Encounter {
  return {
    type: 'encounter',
    enemy: {
      name: 'Test Brute',
      image: 'brute.png',
      toughness: 'tough',
      health: 20,
      hit,
    },
    behaviour: 'custom',
    pattern,
    altPattern: null,
    tellClarity: 'clear',
    allowRetreat: true,
    exits: {
      victory: { effects: [] },
      defeat: { effects: [] },
      retreat: { effects: [] },
    },
  };
}

function makeFightState(overrides: Partial<FightState> = {}): FightState {
  return {
    enemyHealth: 20,
    enemyMaxHealth: 20,
    enemyHit: 2,
    playerHealth: 10,
    playerMaxHealth: 10,
    playerStartingHealth: 10,
    playerBuffer: 0,
    playerMaxBuffer: 0,
    playerWeaponDamage: 2,
    beatNumber: 0,
    pattern: ['strike', 'heavy'],
    altPattern: null,
    activePattern: ['strike', 'heavy'],
    patternIndex: 0,
    loopCount: 0,
    phase: 0,
    currentTactic: 'steady',
    pendingOpen: false,
    firedMoments: [],
    pendingMomentQueue: [],
    revealedTells: false,
    allyActions: [],
    unlockedChoices: [],
    unlockedExits: [],
    releasedHealthFloor: false,
    playthroughId: 'pt-1',
    encounterId: 'enc-1',
    status: 'ongoing',
    exitKey: null,
    beatLog: [],
    ...overrides,
  };
}

function deepFreeze<T>(obj: T): T {
  if (obj && typeof obj === 'object') {
    Object.freeze(obj);
    for (const value of Object.values(obj as Record<string, unknown>)) {
      deepFreeze(value);
    }
  }
  return obj;
}

describe('resolveBeat', () => {
  const moves: Move[] = ['strike', 'heavy', 'open'];
  const tactics: Tactic[] = ['press', 'steady', 'guard'];
  const hitValues = [1, 2];
  const weaponDamages = [1, 2, 3, 4];

  const expectedTable: Record<
    Move,
    Record<Tactic, (d: number, h: number) => { dealt: number; taken: number; pendingOpen: boolean }>
  > = {
    strike: {
      press: (d, h) => ({ dealt: d + 1, taken: h + 1, pendingOpen: false }),
      steady: (d, h) => ({ dealt: d, taken: h, pendingOpen: false }),
      guard: (_d, h) => ({ dealt: 0, taken: Math.ceil(h / 2), pendingOpen: false }),
    },
    heavy: {
      press: (d, h) => ({ dealt: d + 1, taken: 2 * h + 1, pendingOpen: false }),
      steady: (d, h) => ({ dealt: d, taken: 2 * h, pendingOpen: false }),
      guard: () => ({ dealt: 0, taken: 0, pendingOpen: true }),
    },
    open: {
      press: (d) => ({ dealt: 2 * d, taken: 0, pendingOpen: false }),
      steady: (d) => ({ dealt: d, taken: 0, pendingOpen: false }),
      guard: () => ({ dealt: 0, taken: 0, pendingOpen: false }),
    },
  };

  for (const h of hitValues) {
    for (const d of weaponDamages) {
      for (const move of moves) {
        for (const tactic of tactics) {
          it(`resolves move=${move} tactic=${tactic} with D=${d}, H=${h}`, () => {
            const encounter = makeEncounter([move], h);
            const initial = makeFightState({
              enemyHealth: 30,
              enemyMaxHealth: 30,
              enemyHit: h,
              playerHealth: 20,
              playerMaxHealth: 20,
              playerStartingHealth: 20,
              playerWeaponDamage: d,
              pattern: [move],
              activePattern: [move],
              pendingOpen: move === 'open',
            });

            const { state } = resolveBeat(initial, encounter, tactic);
            const expected = expectedTable[move][tactic](d, h);
            expect(30 - state.enemyHealth).toBe(expected.dealt);
            expect(20 - state.playerHealth).toBe(expected.taken);
            expect(state.pendingOpen).toBe(expected.pendingOpen);
            expect(state.beatNumber).toBe(1);
          });
        }
      }
    }
  }

  it('absorbs damage with buffer first and spills remainder into health', () => {
    const encounter = makeEncounter(['heavy'], 2);
    const initial = makeFightState({
      enemyHit: 2,
      playerBuffer: 3,
      playerMaxBuffer: 4,
      playerHealth: 6,
      playerMaxHealth: 6,
      pattern: ['heavy'],
      activePattern: ['heavy'],
    });

    const { state, events } = resolveBeat(initial, encounter, 'steady');
    // Steady vs Heavy with H=2 deals 4 damage to player: 3 absorbed by buffer, 1 spills to health.
    expect(state.playerBuffer).toBe(0);
    expect(state.playerHealth).toBe(5);
    expect(events).toContainEqual({ type: 'bufferAbsorbed', amount: 3 });
    expect(events).toContainEqual({ type: 'playerDamaged', amount: 1 });
  });

  it('plays Open after a guarded Heavy without advancing pattern index, then resumes pattern', () => {
    const pattern: Move[] = ['heavy', 'strike', 'heavy'];
    const encounter = makeEncounter(pattern, 2);
    const state0 = makeFightState({
      pattern,
      activePattern: pattern,
      patternIndex: 0,
    });

    // Beat 1: Guard against Heavy -> pendingOpen becomes true, patternIndex advances to 1 (strike).
    const r1 = resolveBeat(state0, encounter, 'guard');
    expect(r1.state.pendingOpen).toBe(true);
    expect(r1.state.patternIndex).toBe(1);
    expect(r1.events).toContainEqual({ type: 'heavyBlocked', move: 'heavy', tactic: 'guard' });

    // Beat 2: Press against inserted Open -> deals 2D=4, patternIndex stays 1.
    const r2 = resolveBeat(r1.state, encounter, 'press');
    expect(r2.state.pendingOpen).toBe(false);
    expect(r2.state.enemyHealth).toBe(16);
    expect(r2.state.playerHealth).toBe(10);
    expect(r2.state.patternIndex).toBe(1);
    expect(r2.events).toContainEqual({ type: 'enemyMove', move: 'open', tactic: 'press' });

    // Beat 3: Resumes pattern at index 1 ('strike').
    const r3 = resolveBeat(r2.state, encounter, 'steady');
    expect(r3.events).toContainEqual({ type: 'enemyMove', move: 'strike', tactic: 'steady' });
    expect(r3.state.patternIndex).toBe(2);
  });

  it('does not mutate a deeply frozen FightState', () => {
    const encounter = makeEncounter(['strike', 'heavy'], 1);
    const frozen = deepFreeze(makeFightState({ enemyHit: 1, playerBuffer: 2 }));
    expect(() => resolveBeat(frozen, encounter, 'press')).not.toThrow();
  });

  it('prevents enemy counter-attack on a killing blow during a Heavy beat', () => {
    const encounter = makeEncounter(['heavy'], 2);
    const initial = makeFightState({
      enemyHealth: 3,
      enemyHit: 2,
      playerHealth: 6,
      playerBuffer: 0,
      playerWeaponDamage: 2,
      pattern: ['heavy'],
      activePattern: ['heavy'],
    });

    // Press deals D+1 = 3, killing the enemy before Heavy lands.
    const { state, events } = resolveBeat(initial, encounter, 'press');
    expect(state.enemyHealth).toBe(0);
    expect(state.playerHealth).toBe(6);
    expect(events).toContainEqual({ type: 'enemyDefeated' });
    expect(events.some((e) => e.type === 'playerDamaged')).toBe(false);
  });
});
