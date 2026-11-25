import type {
  BeatEvent,
  Encounter,
  FightState,
  Move,
  Tactic,
} from './types';

export interface ResolveBeatResult {
  state: FightState;
  events: BeatEvent[];
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
