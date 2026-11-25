import { BARE_HANDS_DAMAGE, NO_ARMOUR_BUFFER } from './constants';
import type {
  BeatEvent,
  Encounter,
  ExitKey,
  FightResult,
  FightState,
  Move,
  PlayerCombatState,
  Tactic,
} from './types';

export interface StartFightOptions {
  playthroughId?: string;
  encounterId?: string;
}

export interface ResolveBeatResult {
  state: FightState;
  events: BeatEvent[];
}

export function startFight(
  encounter: Encounter,
  player: PlayerCombatState,
  options: StartFightOptions = {},
): FightState {
  const playerBuffer = player.armour?.buffer ?? NO_ARMOUR_BUFFER;
  const playerWeaponDamage = player.weapon?.damage ?? BARE_HANDS_DAMAGE;
  const pattern = [...encounter.pattern];
  const altPattern = encounter.altPattern ? [...encounter.altPattern] : null;

  return {
    enemyHealth: encounter.enemy.health,
    enemyMaxHealth: encounter.enemy.health,
    enemyHit: encounter.enemy.hit,
    playerHealth: player.health,
    playerMaxHealth: player.maxHealth,
    playerStartingHealth: player.health,
    playerBuffer,
    playerMaxBuffer: playerBuffer,
    playerWeaponDamage,
    beatNumber: 0,
    pattern,
    altPattern,
    activePattern: [...pattern],
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
    playthroughId: options.playthroughId ?? 'default-playthrough',
    encounterId: options.encounterId ?? 'default-encounter',
    status: 'ongoing',
    exitKey: null,
    beatLog: [],
  };
}

export function advanceBeat(
  state: FightState,
  encounter: Encounter,
  tactic: Tactic = state.currentTactic,
): ResolveBeatResult {
  if (state.status === 'finished') {
    throw new Error('Cannot advance a fight that has already finished.');
  }

  const { state: resolved, events } = resolveBeat(state, encounter, tactic);
  let status: FightState['status'] = resolved.status;
  let exitKey: ExitKey | null = resolved.exitKey;

  if (resolved.enemyHealth === 0) {
    status = 'finished';
    exitKey = 'victory';
  } else if (resolved.playerHealth === 0) {
    status = 'finished';
    exitKey = 'defeat';
  }

  return {
    state: {
      ...resolved,
      status,
      exitKey,
    },
    events,
  };
}

export function retreatFight(
  state: FightState,
  encounter: Encounter,
): ResolveBeatResult {
  if (!encounter.allowRetreat) {
    throw new Error('Retreat is disabled for this encounter.');
  }
  if (state.status === 'finished') {
    throw new Error('Cannot retreat from a fight that has already finished.');
  }

  const events: BeatEvent[] = [];
  const dmg = applyIncomingDamage(state.playerBuffer, state.playerHealth, state.enemyHit);

  if (dmg.bufferAbsorbed > 0) {
    events.push({ type: 'bufferAbsorbed', amount: dmg.bufferAbsorbed });
  }
  if (dmg.healthLost > 0) {
    events.push({ type: 'playerDamaged', amount: dmg.healthLost });
  }

  const exitKey: ExitKey = dmg.nextHealth === 0 ? 'defeat' : 'retreat';
  if (exitKey === 'defeat') {
    events.push({ type: 'playerDefeated' });
  } else {
    events.push({ type: 'retreat' });
  }

  const nextState: FightState = {
    ...state,
    playerBuffer: dmg.nextBuffer,
    playerHealth: dmg.nextHealth,
    status: 'finished',
    exitKey,
    firedMoments: [...state.firedMoments],
    pendingMomentQueue: [...state.pendingMomentQueue],
    allyActions: [...state.allyActions],
    unlockedChoices: [...state.unlockedChoices],
    unlockedExits: [...state.unlockedExits],
    beatLog: [...state.beatLog],
  };

  return { state: nextState, events };
}

export function finishFight(
  state: FightState,
  encounter: Encounter,
  overrideExitKey?: ExitKey,
): FightResult {
  const exitKey: ExitKey = overrideExitKey ?? state.exitKey ?? 'victory';
  const healthLost = Math.max(0, state.playerStartingHealth - state.playerHealth);
  const healthAfter = exitKey === 'defeat' ? 1 : state.playerHealth;
  const exitEffects = encounter.exits[exitKey]?.effects
    ? [...encounter.exits[exitKey].effects]
    : [];

  return {
    exitKey,
    healthAfter,
    beatsPlayed: state.beatNumber,
    healthLost,
    clean: healthLost === 0,
    bloodied: healthAfter <= 2,
    bufferDiscarded: true,
    exitEffects,
  };
}

export function getUpcomingMove(state: Pick<FightState, 'pendingOpen' | 'activePattern' | 'patternIndex'>): Move {
  if (state.pendingOpen) {
    return 'open';
  }
  const index = state.patternIndex % state.activePattern.length;
  return state.activePattern[index];
}

export function applyIncomingDamage(
  playerBuffer: number,
  playerHealth: number,
  incomingDamage: number,
): {
  nextBuffer: number;
  nextHealth: number;
  bufferAbsorbed: number;
  healthLost: number;
} {
  if (incomingDamage <= 0) {
    return {
      nextBuffer: playerBuffer,
      nextHealth: playerHealth,
      bufferAbsorbed: 0,
      healthLost: 0,
    };
  }
  const bufferAbsorbed = Math.min(playerBuffer, incomingDamage);
  const remainingDamage = incomingDamage - bufferAbsorbed;
  const nextBuffer = playerBuffer - bufferAbsorbed;
  const healthLost = Math.min(playerHealth, remainingDamage);
  const nextHealth = Math.max(0, playerHealth - remainingDamage);
  return {
    nextBuffer,
    nextHealth,
    bufferAbsorbed,
    healthLost,
  };
}

function computeCellOutcome(
  move: Move,
  tactic: Tactic,
  weaponDamage: number,
  enemyHit: number,
): {
  playerDamage: number;
  enemyDamage: number;
  setsPendingOpen: boolean;
  heavyBlocked: boolean;
} {
  if (move === 'strike') {
    if (tactic === 'press') {
      return {
        playerDamage: weaponDamage + 1,
        enemyDamage: enemyHit + 1,
        setsPendingOpen: false,
        heavyBlocked: false,
      };
    }
    if (tactic === 'steady') {
      return {
        playerDamage: weaponDamage,
        enemyDamage: enemyHit,
        setsPendingOpen: false,
        heavyBlocked: false,
      };
    }
    return {
      playerDamage: 0,
      enemyDamage: Math.ceil(enemyHit / 2),
      setsPendingOpen: false,
      heavyBlocked: false,
    };
  }

  if (move === 'heavy') {
    if (tactic === 'press') {
      return {
        playerDamage: weaponDamage + 1,
        enemyDamage: enemyHit * 2 + 1,
        setsPendingOpen: false,
        heavyBlocked: false,
      };
    }
    if (tactic === 'steady') {
      return {
        playerDamage: weaponDamage,
        enemyDamage: enemyHit * 2,
        setsPendingOpen: false,
        heavyBlocked: false,
      };
    }
    return {
      playerDamage: 0,
      enemyDamage: 0,
      setsPendingOpen: true,
      heavyBlocked: true,
    };
  }

  // move === 'open'
  if (tactic === 'press') {
    return {
      playerDamage: weaponDamage * 2,
      enemyDamage: 0,
      setsPendingOpen: false,
      heavyBlocked: false,
    };
  }
  if (tactic === 'steady') {
    return {
      playerDamage: weaponDamage,
      enemyDamage: 0,
      setsPendingOpen: false,
      heavyBlocked: false,
    };
  }
  return {
    playerDamage: 0,
    enemyDamage: 0,
    setsPendingOpen: false,
    heavyBlocked: false,
  };
}

/**
 * Resolves a single combat beat deterministically without mutating inputs.
 */
export function resolveBeat(
  state: FightState,
  _encounter: Encounter,
  tactic: Tactic,
): ResolveBeatResult {
  const events: BeatEvent[] = [];
  const wasPendingOpen = state.pendingOpen;
  const movePlayed = getUpcomingMove(state);
  const { playerDamage, enemyDamage, setsPendingOpen, heavyBlocked } = computeCellOutcome(
    movePlayed,
    tactic,
    state.playerWeaponDamage,
    state.enemyHit,
  );

  events.push({ type: 'enemyMove', move: movePlayed, tactic });

  // Player's hit lands first.
  const nextEnemyHealth = Math.max(0, state.enemyHealth - playerDamage);
  if (playerDamage > 0) {
    events.push({ type: 'playerHit', amount: playerDamage, move: movePlayed, tactic });
  }

  let nextBuffer = state.playerBuffer;
  let nextPlayerHealth = state.playerHealth;

  if (nextEnemyHealth === 0) {
    events.push({ type: 'enemyDefeated' });
  } else {
    if (heavyBlocked) {
      events.push({ type: 'heavyBlocked', move: movePlayed, tactic });
    }
    if (enemyDamage > 0) {
      const dmg = applyIncomingDamage(state.playerBuffer, state.playerHealth, enemyDamage);
      nextBuffer = dmg.nextBuffer;
      nextPlayerHealth = dmg.nextHealth;
      if (dmg.bufferAbsorbed > 0) {
        events.push({ type: 'bufferAbsorbed', amount: dmg.bufferAbsorbed });
      }
      if (dmg.healthLost > 0) {
        events.push({ type: 'playerDamaged', amount: dmg.healthLost });
      }
      if (nextPlayerHealth === 0) {
        events.push({ type: 'playerDefeated' });
      }
    }
  }

  let nextPatternIndex = state.patternIndex;
  let nextLoopCount = state.loopCount;
  if (!wasPendingOpen) {
    const rawNext = state.patternIndex + 1;
    if (rawNext >= state.activePattern.length) {
      nextPatternIndex = 0;
      nextLoopCount = state.loopCount + 1;
    } else {
      nextPatternIndex = rawNext;
    }
  }

  const nextPendingOpen = nextEnemyHealth > 0 && nextPlayerHealth > 0 ? setsPendingOpen : false;

  const nextState: FightState = {
    ...state,
    enemyHealth: nextEnemyHealth,
    playerHealth: nextPlayerHealth,
    playerBuffer: nextBuffer,
    beatNumber: state.beatNumber + 1,
    patternIndex: nextPatternIndex,
    loopCount: nextLoopCount,
    currentTactic: tactic,
    pendingOpen: nextPendingOpen,
    firedMoments: [...state.firedMoments],
    pendingMomentQueue: [...state.pendingMomentQueue],
    allyActions: [...state.allyActions],
    unlockedChoices: [...state.unlockedChoices],
    unlockedExits: [...state.unlockedExits],
    beatLog: [...state.beatLog],
  };

  return { state: nextState, events };
}
