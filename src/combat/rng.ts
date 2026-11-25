import type { Move } from './types';

/**
 * Deterministic 32-bit FNV-1a + Murmur finalizer hash.
 * Pure and deterministic.
 */
export function hashSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

export function pickPatternChoice(
  playthroughId: string,
  encounterId: string,
  loopCount: number,
): 0 | 1 {
  const digest = hashSeed(`${playthroughId}::${encounterId}::${loopCount}`);
  return (digest & 1) === 0 ? 0 : 1;
}

export function selectLoopPattern(
  primary: readonly Move[],
  alt: readonly Move[] | null,
  playthroughId: string,
  encounterId: string,
  loopCount: number,
): Move[] {
  if (!alt || alt.length === 0) {
    return [...primary];
  }
  const choice = pickPatternChoice(playthroughId, encounterId, loopCount);
  return choice === 0 ? [...primary] : [...alt];
}
