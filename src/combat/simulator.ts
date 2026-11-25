import { BASE_PLAYER_HEALTH, GEAR_TIERS, type GearTierConfig } from './constants';
import { advanceBeat, getUpcomingMove, startFight } from './resolver';
import type {
  Encounter,
  FightState,
  Move,
  PlayerCombatState,
  StoryStateSnapshot,
  Tactic,
} from './types';

export type SimulationPolicy = (upcomingMove: Move, state: FightState) => Tactic;

export type SimulationOutcome = 'victory' | 'defeat' | 'stall';

export interface SimulationGear {
  tier?: number;
  damage: number;
  buffer: number;
  weaponName?: string;
  armourName?: string;
}

export interface SimulationOptions {
  maxBeats?: number;
  playerHealth?: number;
  playthroughId?: string;
  encounterId?: string;
  storyState?: StoryStateSnapshot;
}

export interface SimulationResult {
  outcome: SimulationOutcome;
  beats: number;
  healthLost: number;
  healthRemaining: number;
  beatsPerPhase: number[];
}

export interface TierSimulationRow {
  tier: number;
  weaponName: string;
  armourName: string;
  damage: number;
  buffer: number;
  autopilot: SimulationResult;
  careful: SimulationResult;
}

export const DEFAULT_SIMULATION_BEAT_CAP = 40;

export const autopilotPolicy: SimulationPolicy = () => 'steady';

export const carefulPolicy: SimulationPolicy = (upcomingMove) => {
  if (upcomingMove === 'heavy') return 'guard';
  if (upcomingMove === 'open') return 'press';
  return 'steady';
};

export const guardHeavyPolicy: SimulationPolicy = (upcomingMove) => {
  if (upcomingMove === 'open') return 'press';
  return 'guard';
};

function buildPlayerForGear(gear: SimulationGear, startingHealth: number): PlayerCombatState {
  return {
    health: startingHealth,
    maxHealth: BASE_PLAYER_HEALTH,
    weapon:
      gear.damage > 0
        ? { id: `sim_weapon_${gear.damage}`, name: gear.weaponName ?? 'Weapon', damage: gear.damage }
        : null,
    armour:
      gear.buffer > 0
        ? { id: `sim_armour_${gear.buffer}`, name: gear.armourName ?? 'Armour', buffer: gear.buffer }
        : null,
    wounds: [],
  };
}

export function simulate(
  encounter: Encounter,
  gear: SimulationGear,
  policy: SimulationPolicy,
  options: SimulationOptions = {},
): SimulationResult {
  const maxBeats = options.maxBeats ?? DEFAULT_SIMULATION_BEAT_CAP;
  const startingHealth = options.playerHealth ?? BASE_PLAYER_HEALTH;
  const player = buildPlayerForGear(gear, startingHealth);

  let state = startFight(encounter, player, {
    playthroughId: options.playthroughId ?? 'sim-playthrough',
    encounterId: options.encounterId ?? 'sim-encounter',
    storyState: options.storyState,
  });

  const beatsPerPhase: number[] = [];

  while (state.status === 'ongoing' && state.beatNumber < maxBeats) {
    const phaseBefore = state.phase;
    while (beatsPerPhase.length <= phaseBefore) {
      beatsPerPhase.push(0);
    }
    const move = getUpcomingMove(state);
    const tactic = policy(move, state);
    const step = advanceBeat(state, encounter, tactic);
    beatsPerPhase[phaseBefore] += 1;
    state = step.state;
  }

  let outcome: SimulationOutcome;
  if (state.status === 'ongoing') {
    outcome = 'stall';
  } else if (state.exitKey === 'victory') {
    outcome = 'victory';
  } else {
    outcome = 'defeat';
  }

  return {
    outcome,
    beats: state.beatNumber,
    healthLost: Math.max(0, startingHealth - state.playerHealth),
    healthRemaining: state.playerHealth,
    beatsPerPhase: beatsPerPhase.length > 0 ? beatsPerPhase : [0],
  };
}

export function simulateAcrossTiers(
  encounter: Encounter,
  tiers: readonly GearTierConfig[] = GEAR_TIERS,
  options: SimulationOptions = {},
): TierSimulationRow[] {
  return tiers.map((tierCfg) => ({
    tier: tierCfg.tier,
    weaponName: tierCfg.weaponName,
    armourName: tierCfg.armourName,
    damage: tierCfg.damage,
    buffer: tierCfg.buffer,
    autopilot: simulate(encounter, tierCfg, autopilotPolicy, options),
    careful: simulate(encounter, tierCfg, carefulPolicy, options),
  }));
}
