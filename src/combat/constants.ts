import type { BehaviourPreset, Move, TellClarity, ToughnessPreset } from './types';

export interface ToughnessConfig {
  health: number;
  hit: number;
  tellClarity: TellClarity;
}

export const TOUGHNESS_PRESETS: Record<ToughnessPreset, ToughnessConfig> = {
  weak: { health: 5, hit: 1, tellClarity: 'clear' },
  standard: { health: 8, hit: 1, tellClarity: 'clear' },
  tough: { health: 12, hit: 2, tellClarity: 'vague' },
  boss: { health: 24, hit: 2, tellClarity: 'vague' },
};

export const BEHAVIOUR_PRESETS: Record<Exclude<BehaviourPreset, 'custom'>, Move[]> = {
  brawler: ['strike', 'strike', 'heavy'],
  brute: ['strike', 'heavy'],
  skirmisher: ['strike', 'strike', 'strike', 'open'],
};

export interface GearTierConfig {
  tier: 1 | 2 | 3;
  weaponName: string;
  damage: number;
  armourName: string;
  buffer: number;
}

export const GEAR_TIERS: readonly GearTierConfig[] = [
  {
    tier: 1,
    weaponName: 'Rusty Sword',
    damage: 2,
    armourName: 'Padded Coat',
    buffer: 2,
  },
  {
    tier: 2,
    weaponName: 'Steel Sword',
    damage: 3,
    armourName: 'Mail',
    buffer: 4,
  },
  {
    tier: 3,
    weaponName: 'Masterwork Sword',
    damage: 4,
    armourName: 'Plate',
    buffer: 6,
  },
] as const;

export const BASE_PLAYER_HEALTH = 6;
export const BARE_HANDS_DAMAGE = 1;
export const NO_ARMOUR_BUFFER = 0;

export const VALID_MOVES: readonly Move[] = ['strike', 'heavy', 'open'];
export const VALID_TACTICS = ['press', 'steady', 'guard'] as const;
export const VALID_TELL_CLARITIES: readonly TellClarity[] = ['clear', 'vague', 'hidden'];
export const VALID_TOUGHNESS_PRESETS: readonly ToughnessPreset[] = [
  'weak',
  'standard',
  'tough',
  'boss',
];
export const VALID_BEHAVIOUR_PRESETS: readonly BehaviourPreset[] = [
  'brawler',
  'brute',
  'skirmisher',
  'custom',
];
