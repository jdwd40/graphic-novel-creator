import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { getEffectiveMaxHealth, getWeaponDamage } from '../playerState';
import { applyFightOutcomeToPlaythrough, StoryPlayer } from '../../player/StoryPlayer';
import { applyStoryEffects, createPlaythrough } from '../../story/playthrough';
import { createSeedStory } from '../../story/seed';
import type { EncounterNode, PassageNode } from '../../story/types';
import { advanceBeat, startFight } from '../resolver';

describe('exit effects, wounds, and manner flags', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('applies the spec Defeat exit: removes steel_sword and adds Cracked rib wound', () => {
    const story = createSeedStory();
    const bruteNode = story.nodes.enc_brute as EncounterNode;
    // Give player steel_sword and defeat them on a modified brute with spec defeat effects
    const specBruteNode: EncounterNode = {
      ...bruteNode,
      encounter: {
        ...bruteNode.encounter,
        exits: {
          ...bruteNode.encounter.exits,
          defeat: {
            effects: [{ removeItem: 'steel_sword' }, { addWound: 'Cracked rib' }],
          },
        },
      },
    };
    const customStory = {
      ...story,
      nodes: { ...story.nodes, enc_brute: specBruteNode },
    };

    let pt = createPlaythrough(customStory);
    pt = applyStoryEffects(pt, customStory, [{ addItem: 'steel_sword' }]);
    expect(getWeaponDamage(pt.combat)).toBe(3);

    let fight = startFight(specBruteNode.encounter, pt.combat);
    fight = { ...fight, playerHealth: 0, status: 'finished', exitKey: 'defeat' };

    const { nextPlaythrough } = applyFightOutcomeToPlaythrough(
      pt,
      customStory,
      specBruteNode,
      fight,
    );

    expect(nextPlaythrough.items).not.toContain('steel_sword');
    expect(getWeaponDamage(nextPlaythrough.combat)).toBe(1);
    expect(nextPlaythrough.combat.wounds.map((w) => w.name)).toContain('Cracked rib');
    expect(getEffectiveMaxHealth(nextPlaythrough.combat)).toBe(5);
  });

  it('caps healing at 5 with one wound and restores max 6 without healing when removed', () => {
    const story = createSeedStory();
    let pt = createPlaythrough(story);
    pt = applyStoryEffects(pt, story, [{ changeHealth: -3 }, { addWound: 'Cracked rib' }]);
    expect(pt.combat.health).toBe(3);
    expect(getEffectiveMaxHealth(pt.combat)).toBe(5);

    // Healing +10 stops at effective max 5
    pt = applyStoryEffects(pt, story, [{ changeHealth: 10 }]);
    expect(pt.combat.health).toBe(5);

    // Removing the wound restores max health to 6 without healing current health
    pt = applyStoryEffects(pt, story, [{ removeWound: 'Cracked rib' }]);
    expect(getEffectiveMaxHealth(pt.combat)).toBe(6);
    expect(pt.combat.health).toBe(5);
  });

  it('displays wounds with their description in the player inventory drawer', () => {
    const story = createSeedStory();
    let pt = createPlaythrough(story);
    pt = applyStoryEffects(pt, story, [
      { addWound: 'Cracked rib', description: 'Sharp pain when drawing breath.' },
    ]);
    render(<StoryPlayer story={story} initialPlaythrough={pt} />);

    fireEvent.click(screen.getByRole('button', { name: /open satchel/i }));
    expect(
      screen.getByText(/Cracked rib \(Sharp pain when drawing breath\.\)/i),
    ).toBeInTheDocument();
  });

  it('allows a later passage to branch on whether an encounter was won clean', () => {
    const base = createSeedStory();
    const shrine = base.nodes.passage_shrine as PassageNode;
    const story = {
      ...base,
      nodes: {
        ...base.nodes,
        passage_shrine: {
          ...shrine,
          choices: [
            ...shrine.choices,
            {
              id: 'c_clean_brag',
              label: 'Note that you took zero scratches',
              targetNodeId: 'passage_victory',
              condition: { flag: 'encounter_enc_gatehouse_clean' },
            },
          ],
        },
      },
    };

    const pt = {
      ...createPlaythrough(story),
      currentNodeId: 'enc_gatehouse',
      combat: {
        ...createPlaythrough(story).combat,
        weapon: { id: 'steel_sword', name: 'Steel Sword', damage: 3 },
        armour: { id: 'mail', name: 'Mail', buffer: 4 },
      },
    };
    render(<StoryPlayer story={story} initialPlaythrough={pt} />);

    // With tier 2 gear (3 dmg, 4 buffer), Steady wins Gatehouse Guard in 3 beats with 0 health lost -> clean!
    for (let i = 0; i < 3; i++) {
      fireEvent.click(screen.getByTestId('combat-tap-zone'));
    }
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByTestId('passage-view-passage_shrine')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Note that you took zero scratches' }),
    ).toBeInTheDocument();
  });

  it('overrides the Defeat health default of 1 when a Defeat exit has a changeHealth effect', () => {
    const story = createSeedStory();
    const encNode = story.nodes.enc_gatehouse as EncounterNode;
    const customNode: EncounterNode = {
      ...encNode,
      encounter: {
        ...encNode.encounter,
        exits: {
          ...encNode.encounter.exits,
          defeat: { effects: [{ changeHealth: 3 }] },
        },
      },
    };
    const pt = createPlaythrough(story);
    const fight = {
      ...startFight(customNode.encounter, pt.combat),
      playerHealth: 0,
      status: 'finished' as const,
      exitKey: 'defeat' as const,
    };

    const { nextPlaythrough } = applyFightOutcomeToPlaythrough(pt, story, customNode, fight);
    expect(nextPlaythrough.combat.health).toBe(3);

    // Also verify beat progression helper imported cleanly
    expect(advanceBeat).toBeTypeOf('function');
  });
});
