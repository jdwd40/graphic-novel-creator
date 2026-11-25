import { EMPTY_STORY_STATE, evaluateCondition } from './conditions';
import { BARE_HANDS_DAMAGE, NO_ARMOUR_BUFFER } from './constants';
import { selectLoopPattern } from './rng';
import type {
  AllyActionState,
  BeatEvent,
  Encounter,
  ExitKey,
  FightResult,
  FightState,
  Moment,
  MomentChoice,
  Move,
  PlayerCombatState,
  StoryStateSnapshot,
  Tactic,
} from './types';

export interface StartFightOptions {
  playthroughId?: string;
  encounterId?: string;
  storyState?: StoryStateSnapshot;
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
  const storyState = options.storyState ?? EMPTY_STORY_STATE;
  let playerBuffer = player.armour?.buffer ?? NO_ARMOUR_BUFFER;
  let playerMaxBuffer = playerBuffer;
  const playerWeaponDamage = player.weapon?.damage ?? BARE_HANDS_DAMAGE;
  const playthroughId = options.playthroughId ?? 'default-playthrough';
  const encounterId = options.encounterId ?? 'default-encounter';

  let enemyHealth = encounter.enemy.health;
  let enemyHit = encounter.enemy.hit;
  let pattern = [...encounter.pattern];
  const altPattern = encounter.altPattern ? [...encounter.altPattern] : null;
  let patternSwapped = false;
  let revealedTells = false;
  const allyActions: AllyActionState[] = [];
  const unlockedChoices: string[] = [];
  const unlockedExits: string[] = [];

  for (const mod of encounter.modifiers ?? []) {
    if (!evaluateCondition(mod.if, storyState)) {
      continue;
    }
    switch (mod.effect) {
      case 'enemyHealth':
        enemyHealth = Math.max(1, enemyHealth + mod.value);
        break;
      case 'enemyHit':
        enemyHit = Math.max(0, enemyHit + mod.value);
        break;
      case 'revealTells':
        revealedTells = true;
        break;
      case 'allyActs':
        allyActions.push({
          beat: mod.beat,
          damage: mod.damage,
          caption: mod.caption,
        });
        break;
      case 'swapPattern':
        if (mod.pattern.length > 0) {
          pattern = [...mod.pattern];
          patternSwapped = true;
        }
        break;
      case 'bonusBuffer':
        playerBuffer = Math.max(0, playerBuffer + mod.value);
        playerMaxBuffer = Math.max(playerMaxBuffer, playerBuffer);
        break;
      case 'unlockChoice':
        if (!unlockedChoices.includes(mod.choiceId)) {
          unlockedChoices.push(mod.choiceId);
        }
        break;
      case 'unlockExit':
        if (!unlockedExits.includes(mod.exitKey)) {
          unlockedExits.push(mod.exitKey);
        }
        break;
    }
  }

  const activePattern = patternSwapped
    ? [...pattern]
    : selectLoopPattern(pattern, altPattern, playthroughId, encounterId, 0);

  const rb = encounter.ruleBreak ?? null;
  const unblockableHeavyCountered =
    rb?.type === 'unblockableHeavyWithoutItem'
      ? storyState.items.includes(rb.item)
      : true;
  const tellsForcedHidden =
    rb?.type === 'hiddenTellsUntilFlag' ? !storyState.flags[rb.flag] : false;

  return {
    enemyHealth,
    enemyMaxHealth: enemyHealth,
    enemyHit,
    playerHealth: player.health,
    playerMaxHealth: player.maxHealth,
    playerStartingHealth: player.health,
    playerBuffer,
    playerMaxBuffer,
    playerWeaponDamage,
    beatNumber: 0,
    pattern,
    altPattern: patternSwapped ? null : altPattern,
    activePattern,
    patternIndex: 0,
    loopCount: 0,
    phase: 0,
    currentTactic: 'steady',
    pendingOpen: false,
    firedMoments: [],
    pendingMomentQueue: [],
    revealedTells,
    allyActions,
    unlockedChoices,
    unlockedExits,
    unblockableHeavyCountered,
    tellsForcedHidden,
    releasedHealthFloor: false,
    playthroughId,
    encounterId,
    status: 'ongoing',
    exitKey: null,
    beatLog: [],
  };
}

function matchesMomentTrigger(
  moment: Moment,
  state: FightState,
  enteredPhases: number[],
): boolean {
  const { trigger } = moment;
  if ('enemyHealthAtMost' in trigger) {
    return state.enemyHealth <= trigger.enemyHealthAtMost;
  }
  if ('playerHealthAtMost' in trigger) {
    return state.playerHealth <= trigger.playerHealthAtMost;
  }
  if ('beat' in trigger) {
    return state.beatNumber === trigger.beat;
  }
  if ('phaseStart' in trigger) {
    return enteredPhases.includes(trigger.phaseStart);
  }
  return false;
}

function collectDueMoments(
  state: FightState,
  encounter: Encounter,
  enteredPhases: number[],
): { firedMoments: number[]; pendingMomentQueue: number[]; events: BeatEvent[] } {
  const moments = encounter.moments ?? [];
  if (moments.length === 0 || state.enemyHealth <= 0 || state.playerHealth <= 0) {
    return {
      firedMoments: state.firedMoments,
      pendingMomentQueue: state.pendingMomentQueue,
      events: [],
    };
  }

  const fired = [...state.firedMoments];
  const queue = [...state.pendingMomentQueue];
  const events: BeatEvent[] = [];

  moments.forEach((moment, idx) => {
    if (fired.includes(idx)) return;
    if (matchesMomentTrigger(moment, state, enteredPhases)) {
      fired.push(idx);
      queue.push(idx);
      events.push({ type: 'momentTriggered', momentIndex: idx });
    }
  });

  return { firedMoments: fired, pendingMomentQueue: queue, events };
}

export function getActiveMoment(
  state: FightState,
  encounter: Encounter,
): { index: number; moment: Moment } | null {
  const idx = state.pendingMomentQueue[0];
  if (idx === undefined) return null;
  const moment = encounter.moments?.[idx];
  if (!moment) return null;
  return { index: idx, moment };
}

export interface AvailableMomentChoice {
  choiceIndex: number;
  choice: MomentChoice;
}

export function getAvailableMomentChoices(
  state: FightState,
  encounter: Encounter,
  storyState: StoryStateSnapshot = EMPTY_STORY_STATE,
): AvailableMomentChoice[] {
  const active = getActiveMoment(state, encounter);
  if (!active) return [];

  const available: AvailableMomentChoice[] = [];
  active.moment.choices.forEach((choice, choiceIndex) => {
    if (choice.requiresUnlock && !state.unlockedChoices.includes(choice.requiresUnlock)) {
      return;
    }
    if (choice.condition && !evaluateCondition(choice.condition, storyState)) {
      return;
    }
    available.push({ choiceIndex, choice });
  });
  return available;
}

export function resolveMomentChoice(
  state: FightState,
  encounter: Encounter,
  choiceIndex: number,
  storyState: StoryStateSnapshot = EMPTY_STORY_STATE,
): ResolveBeatResult {
  const active = getActiveMoment(state, encounter);
  if (!active) {
    throw new Error('No open moment to resolve.');
  }
  const available = getAvailableMomentChoices(state, encounter, storyState);
  const picked = available.find((c) => c.choiceIndex === choiceIndex);
  if (!picked) {
    throw new Error(`Moment choice ${choiceIndex} is not available.`);
  }

  const remainingQueue = state.pendingMomentQueue.slice(1);
  const events: BeatEvent[] = [];

  if (picked.choice.then === 'exit') {
    const exitKey: ExitKey = picked.choice.exit ?? 'victory';
    return {
      state: {
        ...state,
        pendingMomentQueue: [],
        status: 'finished',
        exitKey,
      },
      events,
    };
  }

  let nextEnemyHealth = state.enemyHealth;
  if (typeof picked.choice.enemyHealthDelta === 'number') {
    nextEnemyHealth = Math.max(0, nextEnemyHealth + picked.choice.enemyHealthDelta);
  }

  let releasedHealthFloor = state.releasedHealthFloor;
  if (
    encounter.ruleBreak?.type === 'healthFloorUntilMoment' &&
    encounter.ruleBreak.momentIndex === active.index
  ) {
    releasedHealthFloor = true;
  }

  if (
    encounter.winCondition?.type === 'reachMoment' &&
    encounter.winCondition.momentIndex === active.index
  ) {
    return {
      state: {
        ...state,
        enemyHealth: nextEnemyHealth,
        releasedHealthFloor,
        pendingMomentQueue: [],
        status: 'finished',
        exitKey: 'victory',
      },
      events,
    };
  }

  if (nextEnemyHealth === 0) {
    events.push({ type: 'enemyDefeated' });
    return {
      state: {
        ...state,
        enemyHealth: 0,
        releasedHealthFloor,
        pendingMomentQueue: [],
        status: 'finished',
        exitKey: 'victory',
      },
      events,
    };
  }

  return {
    state: {
      ...state,
      enemyHealth: nextEnemyHealth,
      releasedHealthFloor,
      pendingMomentQueue: remainingQueue,
    },
    events,
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
  if (state.pendingMomentQueue.length > 0) {
    throw new Error('Cannot resolve a beat while a moment is open.');
  }

  const { state: resolved, events } = resolveBeat(state, encounter, tactic);
  let status: FightState['status'] = resolved.status;
  let exitKey: ExitKey | null = resolved.exitKey;
  let nextState = resolved;

  if (resolved.enemyHealth === 0) {
    status = 'finished';
    exitKey = 'victory';
  } else if (resolved.playerHealth === 0) {
    status = 'finished';
    exitKey = 'defeat';
  } else if (
    encounter.winCondition?.type === 'surviveBeats' &&
    resolved.beatNumber >= encounter.winCondition.beats
  ) {
    status = 'finished';
    exitKey = 'victory';
  } else {
    const phases = encounter.phases ?? [];
    const enteredPhases: number[] = [];
    if (phases.length > 0) {
      const sorted = phases
        .map((p, idx) => ({ phaseNum: idx + 1, ...p }))
        .sort((a, b) => b.healthAtMost - a.healthAtMost);
      for (const p of sorted) {
        if (p.phaseNum > nextState.phase && nextState.enemyHealth <= p.healthAtMost) {
          enteredPhases.push(p.phaseNum);
        }
      }
      if (enteredPhases.length > 0) {
        const latestPhaseNum = enteredPhases[enteredPhases.length - 1];
        const latestPhase = phases[latestPhaseNum - 1];
        nextState = {
          ...nextState,
          phase: latestPhaseNum,
          activePattern:
            latestPhase && latestPhase.pattern.length > 0
              ? [...latestPhase.pattern]
              : nextState.activePattern,
          patternIndex: 0,
        };
        events.push({ type: 'phaseChanged', phase: latestPhaseNum });
      }
    }

    const due = collectDueMoments(nextState, encounter, enteredPhases);
    if (due.events.length > 0) {
      events.push(...due.events);
      nextState = {
        ...nextState,
        firedMoments: due.firedMoments,
        pendingMomentQueue: due.pendingMomentQueue,
      };
    }
  }

  return {
    state: {
      ...nextState,
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
  const exitEffects = encounter.exits[exitKey]?.effects
    ? [...encounter.exits[exitKey].effects]
    : [];
  const hasChangeHealth = exitEffects.some((e) => 'changeHealth' in e);
  const healthAfter =
    exitKey === 'defeat' ? (hasChangeHealth ? 0 : 1) : state.playerHealth;

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
  encounter: Encounter,
  tactic: Tactic,
): ResolveBeatResult {
  const events: BeatEvent[] = [];
  const nextBeatNumber = state.beatNumber + 1;
  const wasPendingOpen = state.pendingOpen;
  const movePlayed = getUpcomingMove(state);
  const { playerDamage, ...cellRest } = computeCellOutcome(
    movePlayed,
    tactic,
    state.playerWeaponDamage,
    state.enemyHit,
  );
  let { enemyDamage, setsPendingOpen, heavyBlocked } = cellRest;

  // Rule-break: unblockable Heavy without required item
  if (
    movePlayed === 'heavy' &&
    tactic === 'guard' &&
    encounter.ruleBreak?.type === 'unblockableHeavyWithoutItem' &&
    state.unblockableHeavyCountered === false
  ) {
    enemyDamage = state.enemyHit * 2;
    setsPendingOpen = false;
    heavyBlocked = false;
  }

  // Ally acts on the scheduled beat before the player's hit.
  let enemyHealthAfterAlly = state.enemyHealth;
  for (const ally of state.allyActions) {
    if (ally.beat === nextBeatNumber && enemyHealthAfterAlly > 0) {
      enemyHealthAfterAlly = Math.max(0, enemyHealthAfterAlly - ally.damage);
      events.push({
        type: 'allyActed',
        amount: ally.damage,
        caption: ally.caption,
      });
    }
  }

  events.push({ type: 'enemyMove', move: movePlayed, tactic });

  // Player's hit lands first (after ally hit).
  const appliedPlayerDamage = enemyHealthAfterAlly > 0 ? playerDamage : 0;
  let nextEnemyHealth = Math.max(0, enemyHealthAfterAlly - appliedPlayerDamage);
  if (
    encounter.ruleBreak?.type === 'healthFloorUntilMoment' &&
    !state.releasedHealthFloor &&
    nextEnemyHealth < encounter.ruleBreak.floor
  ) {
    nextEnemyHealth = Math.min(state.enemyHealth, encounter.ruleBreak.floor);
  }
  if (appliedPlayerDamage > 0) {
    events.push({ type: 'playerHit', amount: appliedPlayerDamage, move: movePlayed, tactic });
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
  let nextActivePattern = state.activePattern;
  if (!wasPendingOpen) {
    const rawNext = state.patternIndex + 1;
    if (rawNext >= state.activePattern.length) {
      nextPatternIndex = 0;
      nextLoopCount = state.loopCount + 1;
      if (state.phase === 0) {
        nextActivePattern = selectLoopPattern(
          state.pattern,
          state.altPattern,
          state.playthroughId,
          state.encounterId,
          nextLoopCount,
        );
      }
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
    activePattern: [...nextActivePattern],
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
