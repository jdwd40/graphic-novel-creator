import { getUpcomingMove } from './resolver';
import type { Encounter, FightState } from './types';

function nonEmpty(value: string | undefined): string | null {
  return value && value.trim() !== '' ? value : null;
}

/**
 * Selects the panel illustration for the current combat state.
 * Priority: phase art -> Open -> enemy wounded -> player wounded -> base.
 */
export function selectEncounterArt(encounter: Encounter, state: FightState): string {
  if (state.phase > 0) {
    const phaseArt =
      nonEmpty(encounter.phases?.[state.phase - 1]?.image) ??
      nonEmpty(encounter.art?.phases?.[state.phase]);
    if (phaseArt) return phaseArt;
  }

  if (getUpcomingMove(state) === 'open') {
    const openArt = nonEmpty(encounter.art?.open);
    if (openArt) return openArt;
  }

  if (state.enemyHealth <= Math.floor(state.enemyMaxHealth / 2)) {
    const enemyWoundedArt = nonEmpty(encounter.art?.enemyWounded);
    if (enemyWoundedArt) return enemyWoundedArt;
  }

  if (state.playerHealth <= 2) {
    const playerWoundedArt = nonEmpty(encounter.art?.playerWounded);
    if (playerWoundedArt) return playerWoundedArt;
  }

  return encounter.enemy.image;
}
