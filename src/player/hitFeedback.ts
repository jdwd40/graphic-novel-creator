import type { BeatEvent, FightState, Tactic } from '../combat/types';
import type { CombatFeedbackState } from './CombatScreen';

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function deriveHitFeedback(
  prevState: FightState,
  nextState: FightState,
  events: BeatEvent[],
  tactic: Tactic,
  reducedMotion = prefersReducedMotion(),
): CombatFeedbackState {
  const enemyLostPips = Math.max(0, prevState.enemyHealth - nextState.enemyHealth);
  const playerLostPips = Math.max(0, prevState.playerHealth - nextState.playerHealth);
  const bufferLostPips = Math.max(0, prevState.playerBuffer - nextState.playerBuffer);
  const playerWasHit = events.some(
    (e) => e.type === 'playerDamaged' || e.type === 'bufferAbsorbed',
  );

  const moveEvent = events.find((e) => e.type === 'enemyMove');
  const move = moveEvent?.move ?? 'strike';
  const heavyBlocked = events.some((e) => e.type === 'heavyBlocked');

  let sfxText: string | null = null;
  let sfxVariant: CombatFeedbackState['sfxVariant'] = 'normal';

  if (heavyBlocked) {
    sfxText = 'CLANG!';
    sfxVariant = 'heavy-blocked';
  } else if (move === 'heavy') {
    sfxText = 'CRUSH!';
    sfxVariant = 'heavy-landed';
  } else if (move === 'open') {
    if (tactic === 'press') sfxText = 'POW!';
    else if (tactic === 'steady') sfxText = 'WHACK!';
    else sfxText = 'HOLD!';
  } else {
    if (tactic === 'press') sfxText = 'SLASH!';
    else if (tactic === 'guard') sfxText = 'CLANK!';
    else sfxText = 'THUD!';
  }

  return {
    sfxText,
    sfxVariant,
    shakePlayer: !reducedMotion && playerWasHit,
    enemyLostPips,
    playerLostPips,
    bufferLostPips,
  };
}
