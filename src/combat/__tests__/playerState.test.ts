import { beforeEach, describe, expect, it } from 'vitest';
import {
  applyHealthChange,
  createInitialPlayerCombatState,
  gainEquipment,
  getArmourBuffer,
  getWeaponDamage,
} from '../playerState';
import {
  applyStoryEffects,
  createPlaythrough,
  loadPlaythrough,
  savePlaythrough,
} from '../../story/playthrough';
import { createSeedStory } from '../../story/seed';

describe('player combat state and equipment', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts a new playthrough at health 6 with bare hands (1) and no armour (0)', () => {
    const initial = createInitialPlayerCombatState();
    expect(initial.health).toBe(6);
    expect(initial.maxHealth).toBe(6);
    expect(getWeaponDamage(initial)).toBe(1);
    expect(getArmourBuffer(initial)).toBe(0);
  });

  it('equips a higher-tier weapon and shows the upgrade message, ignoring equal or lower tiers', () => {
    const story = createSeedStory();
    const s0 = createInitialPlayerCombatState();

    const t1 = gainEquipment(s0, story.items.rusty_sword);
    expect(t1.state.weapon?.damage).toBe(2);
    expect(t1.message).toBe('Rusty Sword, damage 2 (was 1)');

    const t2 = gainEquipment(t1.state, story.items.steel_sword);
    expect(t2.state.weapon?.damage).toBe(3);
    expect(t2.message).toBe('Steel Sword, damage 3 (was 2)');

    const downgrade = gainEquipment(t2.state, story.items.rusty_sword);
    expect(downgrade.state.weapon?.id).toBe('steel_sword');
    expect(downgrade.state.weapon?.damage).toBe(3);
    expect(downgrade.message).toBeNull();
  });

  it('clamps heal and damage effects between 0 and maximum health', () => {
    const s0 = createInitialPlayerCombatState();
    const hurt = applyHealthChange(s0, -4);
    expect(hurt.health).toBe(2);

    const overHealed = applyHealthChange(hurt, 99);
    expect(overHealed.health).toBe(6);

    const overkill = applyHealthChange(hurt, -99);
    expect(overkill.health).toBe(0);
  });

  it('persists player combat state and equipment with the playthrough', () => {
    const story = createSeedStory();
    let pt = createPlaythrough(story);
    pt = applyStoryEffects(pt, story, [
      { addItem: 'steel_sword' },
      { addItem: 'mail_hauberk' },
      { changeHealth: -2 },
    ]);
    expect(pt.notifications).toContain('Steel Sword, damage 3 (was 1)');
    expect(pt.notifications).toContain('Mail, buffer 4 (was 0)');

    savePlaythrough(pt);
    const reloaded = loadPlaythrough(story.id);
    expect(reloaded).not.toBeNull();
    expect(reloaded!.combat.health).toBe(4);
    expect(reloaded!.combat.weapon?.damage).toBe(3);
    expect(reloaded!.combat.armour?.buffer).toBe(4);
  });
});
