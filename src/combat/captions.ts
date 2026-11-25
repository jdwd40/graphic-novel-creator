import { getUpcomingMove } from './resolver';
import type {
  BeatEvent,
  Encounter,
  FightState,
  Move,
  ResultCaptionKey,
  Tactic,
  TellClarity,
} from './types';

export const BUILTIN_CLEAR_TELL_CAPTIONS: Record<Move, readonly string[]> = {
  strike: [
    'Your foe sets a foot and lines up a quick strike.',
    'Their shoulder dips for a fast, direct blow.',
    'They measure the distance and ready a sharp strike.',
  ],
  heavy: [
    'They draw back for a massive, telegraphed heavy swing.',
    'Both hands tighten as they wind up a crushing blow.',
    'They plant their boots and raise their weapon high for a heavy blow.',
  ],
  open: [
    'Off balance and wide open, they scramble to recover.',
    'Their guard drops completely, leaving a clear opening.',
    'Momentum carries them forward and leaves them open.',
  ],
};

export const BUILTIN_VAGUE_TELL_CAPTIONS: Record<Move, readonly string[]> = {
  strike: [
    'They shift their weight and watch your hands.',
    'A subtle exhale ripples across their stance.',
    'Their eyes narrow as they test your footing.',
  ],
  heavy: [
    'They adjust their grip and lean into the shadows.',
    'Their breathing slows as they circle half a step.',
    'Muscles coil beneath their coat, giving nothing away.',
  ],
  open: [
    'They pause for a heartbeat, chest rising fast.',
    'A boot scrapes loose stone as they reset.',
    'They blink hard and settle their stance.',
  ],
};

export const BUILTIN_RESULT_CAPTIONS: Record<ResultCaptionKey, readonly string[]> = {
  strikeTraded: [
    'You trade clean blows and hold your ground.',
    'Steel meets steel as both of you land a glancing hit.',
    'You step in, take the graze, and answer back.',
  ],
  strikePressed: [
    'You surge forward recklessly, trading hard blows.',
    'Your aggressive lunge lands deep, though their counter clips you.',
    'You force the pace and both sides pay for it.',
  ],
  strikeGuarded: [
    'You raise your guard and turn the worst of the blow aside.',
    'The impact jars your arm, blunted by a tight block.',
    'You hold the line and absorb only a fraction of the hit.',
  ],
  heavyLanded: [
    'Their full-force blow crashes through your stance.',
    'The heavy impact rattles your ribs as you land a counter.',
    'You strike back, but their crushing swing connects hard.',
  ],
  heavyPressed: [
    'You rush straight into their windup, trading a wild hit for a brutal blow.',
    'Your reckless charge lands, but their full swing slams into you.',
    'You press through the storm and take the full weight of their attack.',
  ],
  heavyBlocked: [
    'You catch the blow squarely, knocking them wide off balance!',
    'Your block deflects the momentum and leaves them staggered.',
    'The heavy swing glances off your guard, exposing an opening.',
  ],
  openPunished: [
    'You seize the opening and drive home a punishing blow!',
    'Before they can recover, your relentless assault lands clean.',
    'You press the advantage and strike while they are helpless.',
  ],
  openSteady: [
    'You take a measured swing into their exposed flank.',
    'With clean form, you punish their momentary lapse.',
    'You step forward and land a solid hit unopposed.',
  ],
  openGuarded: [
    'You keep your guard up and let the moment pass.',
    'Cautious, you hold formation while they catch their breath.',
    'Neither side commits as the breath between blows settles.',
  ],
  enemyDefeated: [
    'Your final blow drops them to the ground.',
    'They stagger back and yield the fight.',
    'With a last gasp of effort, your opponent collapses.',
  ],
  playerDefeated: [
    'The blow overwhelms you and darkness closes in.',
    'Your knees buckle as the fight slips out of reach.',
    'Battered and spent, you hit the floor.',
  ],
  retreat: [
    'They clip you as you break away and slip out of reach.',
    'You take a parting blow and disengage from the fight.',
    'A stinging hit grazes your shoulder as you fall back.',
  ],
};

export interface TellInfo {
  move: Move;
  clarity: TellClarity;
  caption: string | null;
  showIcon: boolean;
}

export function getEffectiveClarity(state: FightState, encounter: Encounter): TellClarity {
  return state.revealedTells ? 'clear' : encounter.tellClarity;
}

export function getTellPool(
  move: Move,
  clarity: TellClarity,
  encounter: Encounter,
): readonly string[] {
  if (clarity === 'hidden') {
    return [];
  }
  const custom = encounter.captions?.tell?.[move];
  if (custom && custom.length > 0) {
    return custom;
  }
  return clarity === 'clear'
    ? BUILTIN_CLEAR_TELL_CAPTIONS[move]
    : BUILTIN_VAGUE_TELL_CAPTIONS[move];
}

export function getResultPool(
  key: ResultCaptionKey,
  encounter: Encounter,
): readonly string[] {
  const custom = encounter.captions?.result?.[key];
  if (custom && custom.length > 0) {
    return custom;
  }
  return BUILTIN_RESULT_CAPTIONS[key];
}

export function nextTell(state: FightState, encounter: Encounter): TellInfo {
  const move = getUpcomingMove(state);
  const clarity = getEffectiveClarity(state, encounter);

  if (clarity === 'hidden') {
    return {
      move,
      clarity,
      caption: null,
      showIcon: false,
    };
  }

  const pool = getTellPool(move, clarity, encounter);
  const caption = pool.length > 0 ? pool[state.beatNumber % pool.length] : null;

  return {
    move,
    clarity,
    caption,
    showIcon: clarity === 'clear',
  };
}

export function inferResultCaptionKey(
  events: BeatEvent[],
  tactic: Tactic,
): ResultCaptionKey {
  if (events.some((e) => e.type === 'retreat')) {
    return 'retreat';
  }
  if (events.some((e) => e.type === 'enemyDefeated')) {
    return 'enemyDefeated';
  }
  if (events.some((e) => e.type === 'playerDefeated')) {
    return 'playerDefeated';
  }
  if (events.some((e) => e.type === 'heavyBlocked')) {
    return 'heavyBlocked';
  }

  const moveEvent = events.find((e) => e.type === 'enemyMove');
  const move = moveEvent?.move ?? 'strike';

  if (move === 'strike') {
    if (tactic === 'press') return 'strikePressed';
    if (tactic === 'guard') return 'strikeGuarded';
    return 'strikeTraded';
  }
  if (move === 'heavy') {
    if (tactic === 'press') return 'heavyPressed';
    if (tactic === 'guard') return 'heavyBlocked';
    return 'heavyLanded';
  }
  // open
  if (tactic === 'press') return 'openPunished';
  if (tactic === 'guard') return 'openGuarded';
  return 'openSteady';
}

export function selectResultCaption(
  events: BeatEvent[],
  tactic: Tactic,
  encounter: Encounter,
  beatNumber: number,
): string {
  const key = inferResultCaptionKey(events, tactic);
  const pool = getResultPool(key, encounter);
  const idx = Math.max(0, beatNumber - 1) % pool.length;
  return pool[idx];
}
