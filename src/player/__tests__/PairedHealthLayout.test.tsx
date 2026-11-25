import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BEHAVIOUR_PRESETS, TOUGHNESS_PRESETS } from '../../combat/constants';
import { startFight } from '../../combat/resolver';
import type { Encounter, PlayerCombatState } from '../../combat/types';
import { createSeedStory } from '../../story/seed';
import { CombatScreen } from '../CombatScreen';

describe('Paired health layout and player portrait (#53)', () => {
  it('renders player portrait paired with player health/armour shields on one side and enemy name + pips on the other', () => {
    const story = createSeedStory();
    const boss = TOUGHNESS_PRESETS.boss;
    const bossEnc: Encounter = {
      type: 'encounter',
      enemy: {
        name: 'Iron Bellwarden',
        image: 'img_seed_bellwarden',
        toughness: 'boss',
        health: boss.health, // 24 health
        hit: boss.hit,
      },
      behaviour: 'brawler',
      pattern: [...BEHAVIOUR_PRESETS.brawler],
      altPattern: null,
      tellClarity: 'clear',
      allowRetreat: false,
      exits: { victory: { effects: [] }, defeat: { effects: [] } },
    };
    const player: PlayerCombatState = {
      health: 5,
      maxHealth: 6,
      weapon: { id: 'w3', name: 'Masterwork Sword', damage: 4 },
      armour: { id: 'a3', name: 'Plate', buffer: 6 },
      wounds: [],
    };
    const fightState = startFight(bossEnc, player);

    Object.defineProperty(window, 'innerWidth', { value: 360, configurable: true });
    render(
      <CombatScreen
        encounter={bossEnc}
        fightState={fightState}
        playerPortrait={story.playerPortrait}
        resultCaption="The Bellwarden rises."
        onAdvanceBeat={() => {}}
        onSelectTactic={() => {}}
        onRetreat={() => {}}
      />,
    );

    const pairedHeader = screen.getByTestId('combat-paired-header');
    const playerSide = within(pairedHeader).getByTestId('combat-player-side');
    const enemySide = within(pairedHeader).getByTestId('combat-enemy-side');

    expect(within(playerSide).getByRole('img', { name: 'Player portrait' })).toBeInTheDocument();
    expect(within(playerSide).getByRole('img', { name: 'Health 5 of 6, armour 6' })).toBeInTheDocument();
    expect(playerSide.querySelectorAll('[data-pip-shape="shield"]')).toHaveLength(6);
    expect(playerSide.querySelectorAll('[data-pip-shape="circle"]')).toHaveLength(6);

    expect(within(enemySide).getByText('Iron Bellwarden')).toBeInTheDocument();
    expect(within(enemySide).getByRole('img', { name: 'Enemy health 24 of 24' })).toBeInTheDocument();
    expect(enemySide.querySelectorAll('[data-pip-shape="circle"]')).toHaveLength(24);
  });
});
