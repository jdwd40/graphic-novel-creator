import {
  applyHealthChange,
  createInitialPlayerCombatState,
  gainEquipment,
  getEffectiveMaxHealth,
} from '../combat/playerState';
import type { FightState, PlayerCombatState } from '../combat/types';
import type { Story, StoryEffect } from './types';

export interface ActiveFightRecord {
  encounterId: string;
  fight: FightState;
  lastResultCaption?: string;
}

export interface StoryNotificationCard {
  id: string;
  kind: 'itemFound' | 'gearChange' | 'itemLost' | 'woundAdded';
  title: string;
  subtitle?: string;
  image?: string;
}

export interface PlaythroughState {
  id: string;
  storyId: string;
  currentNodeId: string;
  flags: Record<string, boolean>;
  items: string[];
  stats: Record<string, number>;
  combat: PlayerCombatState;
  activeFight: ActiveFightRecord | null;
  notifications: string[];
  notificationCards?: StoryNotificationCard[];
}

const PLAYTHROUGH_STORAGE_PREFIX = 'gnc_playthrough_v1_';

export function getPlaythroughStorageKey(storyId: string): string {
  return `${PLAYTHROUGH_STORAGE_PREFIX}${storyId}`;
}

export function createPlaythrough(story: Story, id = `pt_${story.id}_1`): PlaythroughState {
  return {
    id,
    storyId: story.id,
    currentNodeId: story.startNodeId,
    flags: {},
    items: [],
    stats: {},
    combat: createInitialPlayerCombatState(),
    activeFight: null,
    notifications: [],
    notificationCards: [],
  };
}

export function savePlaythrough(playthrough: PlaythroughState): void {
  localStorage.setItem(getPlaythroughStorageKey(playthrough.storyId), JSON.stringify(playthrough));
}

export function loadPlaythrough(storyId: string): PlaythroughState | null {
  const raw = localStorage.getItem(getPlaythroughStorageKey(storyId));
  if (!raw) return null;
  return JSON.parse(raw) as PlaythroughState;
}

export function clearPlaythrough(storyId: string): void {
  localStorage.removeItem(getPlaythroughStorageKey(storyId));
}

function reequipBestFromInventory(
  combat: PlayerCombatState,
  items: string[],
  story: Story,
): PlayerCombatState {
  let next: PlayerCombatState = {
    ...combat,
    weapon: null,
    armour: null,
  };
  for (const itemId of items) {
    const def = story.items[itemId];
    if (!def) continue;
    next = gainEquipment(next, def).state;
  }
  return next;
}

export function applyStoryEffects(
  playthrough: PlaythroughState,
  story: Story,
  effects: readonly StoryEffect[],
): PlaythroughState {
  const nextFlags = { ...playthrough.flags };
  let nextItems = [...playthrough.items];
  let nextCombat = { ...playthrough.combat, wounds: [...playthrough.combat.wounds] };
  const notifications: string[] = [];
  const notificationCards: StoryNotificationCard[] = [];
  let seq = 0;

  for (const effect of effects) {
    if ('setFlag' in effect) {
      nextFlags[effect.setFlag] = true;
    } else if ('addItem' in effect) {
      const wasCarried = nextItems.includes(effect.addItem);
      if (!wasCarried) {
        nextItems.push(effect.addItem);
      }
      const def = story.items[effect.addItem];
      const prevWeaponName = nextCombat.weapon?.name;
      const prevArmourName = nextCombat.armour?.name;
      let subtitle: string | undefined;

      if (def) {
        const res = gainEquipment(nextCombat, def);
        nextCombat = res.state;
        if (res.message) {
          notifications.push(res.message);
        }
        if (typeof def.weaponDamage === 'number' && nextCombat.weapon?.id === def.id) {
          subtitle = prevWeaponName && prevWeaponName !== def.name
            ? `${def.name} replaces ${prevWeaponName}`
            : `Equipped ${def.name}`;
        } else if (typeof def.armourBuffer === 'number' && nextCombat.armour?.id === def.id) {
          subtitle = prevArmourName && prevArmourName !== def.name
            ? `${def.name} replaces ${prevArmourName}`
            : `Equipped ${def.name}`;
        }
      }

      if (!wasCarried || subtitle) {
        seq += 1;
        notificationCards.push({
          id: `card_${Date.now()}_${seq}`,
          kind: subtitle ? 'gearChange' : 'itemFound',
          title: `You found: ${def?.name ?? effect.addItem}`,
          subtitle,
          image: def?.image,
        });
      }
    } else if ('removeItem' in effect) {
      const wasCarried = nextItems.includes(effect.removeItem);
      const def = story.items[effect.removeItem];
      nextItems = nextItems.filter((id) => id !== effect.removeItem);
      if (
        nextCombat.weapon?.id === effect.removeItem ||
        nextCombat.armour?.id === effect.removeItem
      ) {
        nextCombat = reequipBestFromInventory(nextCombat, nextItems, story);
      }
      if (wasCarried) {
        seq += 1;
        notificationCards.push({
          id: `card_${Date.now()}_${seq}`,
          kind: 'itemLost',
          title: `Lost: ${def?.name ?? effect.removeItem}`,
          image: def?.image,
        });
      }
    } else if ('changeHealth' in effect) {
      nextCombat = applyHealthChange(nextCombat, effect.changeHealth);
    } else if ('addWound' in effect) {
      if (!nextCombat.wounds.some((w) => w.name === effect.addWound)) {
        const description =
          effect.description ?? 'Lingering injury: lowers maximum health by 1.';
        nextCombat = {
          ...nextCombat,
          wounds: [
            ...nextCombat.wounds,
            {
              name: effect.addWound,
              description,
            },
          ],
        };
        const cap = getEffectiveMaxHealth(nextCombat);
        if (nextCombat.health > cap) {
          nextCombat = { ...nextCombat, health: cap };
        }
        seq += 1;
        notificationCards.push({
          id: `card_${Date.now()}_${seq}`,
          kind: 'woundAdded',
          title: `Wound: ${effect.addWound}`,
          subtitle: description,
        });
      }
    } else if ('removeWound' in effect) {
      nextCombat = {
        ...nextCombat,
        wounds: nextCombat.wounds.filter((w) => w.name !== effect.removeWound),
      };
    } else if ('rest' in effect && effect.rest) {
      nextCombat = {
        ...nextCombat,
        health: getEffectiveMaxHealth(nextCombat),
      };
    }
  }

  return {
    ...playthrough,
    flags: nextFlags,
    items: nextItems,
    combat: nextCombat,
    notifications,
    notificationCards,
  };
}
