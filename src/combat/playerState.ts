import { BARE_HANDS_DAMAGE, BASE_PLAYER_HEALTH, NO_ARMOUR_BUFFER } from './constants';
import type { EquippedArmour, EquippedWeapon, PlayerCombatState } from './types';

export interface EquipmentDefinition {
  id: string;
  name: string;
  weaponDamage?: number;
  armourBuffer?: number;
}

export function createInitialPlayerCombatState(): PlayerCombatState {
  return {
    health: BASE_PLAYER_HEALTH,
    maxHealth: BASE_PLAYER_HEALTH,
    weapon: null,
    armour: null,
    wounds: [],
  };
}

export function getEffectiveMaxHealth(state: PlayerCombatState): number {
  return Math.max(1, state.maxHealth - state.wounds.length);
}

export function getWeaponDamage(state: PlayerCombatState): number {
  return state.weapon?.damage ?? BARE_HANDS_DAMAGE;
}

export function getArmourBuffer(state: PlayerCombatState): number {
  return state.armour?.buffer ?? NO_ARMOUR_BUFFER;
}

export function gainEquipment(
  state: PlayerCombatState,
  item: EquipmentDefinition,
): { state: PlayerCombatState; message: string | null } {
  let nextState = state;
  const messages: string[] = [];

  if (typeof item.weaponDamage === 'number') {
    const previousDamage = getWeaponDamage(nextState);
    if (item.weaponDamage > previousDamage) {
      nextState = {
        ...nextState,
        weapon: {
          id: item.id,
          name: item.name,
          damage: item.weaponDamage,
        },
      };
      messages.push(`${item.name}, damage ${item.weaponDamage} (was ${previousDamage})`);
    }
  }

  if (typeof item.armourBuffer === 'number') {
    const previousBuffer = getArmourBuffer(nextState);
    if (item.armourBuffer > previousBuffer) {
      nextState = {
        ...nextState,
        armour: {
          id: item.id,
          name: item.name,
          buffer: item.armourBuffer,
        },
      };
      messages.push(`${item.name}, buffer ${item.armourBuffer} (was ${previousBuffer})`);
    }
  }

  return {
    state: nextState,
    message: messages.length > 0 ? messages.join(' · ') : null,
  };
}

export function applyHealthChange(
  state: PlayerCombatState,
  delta: number,
): PlayerCombatState {
  const effectiveMax = getEffectiveMaxHealth(state);
  const nextHealth = Math.max(0, Math.min(effectiveMax, state.health + delta));
  return {
    ...state,
    health: nextHealth,
  };
}

export function setEquipmentDirectly(
  state: PlayerCombatState,
  equipment: {
    weapon?: EquippedWeapon | null;
    armour?: EquippedArmour | null;
  },
): PlayerCombatState {
  return {
    ...state,
    weapon: equipment.weapon !== undefined ? equipment.weapon : state.weapon,
    armour: equipment.armour !== undefined ? equipment.armour : state.armour,
  };
}
