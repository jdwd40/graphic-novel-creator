import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BEHAVIOUR_PRESETS, GEAR_TIERS, TOUGHNESS_PRESETS } from '../../combat/constants';
import { startFight } from '../../combat/resolver';
import type { Encounter, PlayerCombatState } from '../../combat/types';
import { CombatScreen } from '../CombatScreen';

function createEncounter(allowRetreat = true): Encounter {
  const std = TOUGHNESS_PRESETS.standard;
  return {
    type: 'encounter',
    enemy: {
      name: 'Gatehouse Guard',
      image: 'guard.png',
      toughness: 'standard',
      health: std.health,
      hit: std.hit,
    },
    behaviour: 'brawler',
    pattern: [...BEHAVIOUR_PRESETS.brawler],
    altPattern: null,
    tellClarity: 'clear',
    allowRetreat,
    exits: {
      victory: { effects: [] },
      defeat: { effects: [] },
      retreat: { effects: [] },
    },
  };
}

function createPlayer(): PlayerCombatState {
  const t1 = GEAR_TIERS[0];
  return {
    health: 4,
    maxHealth: 6,
    weapon: { id: 'w1', name: t1.weaponName, damage: t1.damage },
    armour: { id: 'a1', name: t1.armourName, buffer: t1.buffer },
    wounds: [],
  };
}

describe('CombatScreen layout and accessibility', () => {
  it('has accessible buttons, selected tactic announcement, health text alternatives, and no numbers on art', () => {
    const encounter = createEncounter(true);
    const state = startFight(encounter, createPlayer());

    render(
      <CombatScreen
        encounter={encounter}
        fightState={state}
        resultCaption="You face the gatehouse guard."
        onAdvanceBeat={() => {}}
        onSelectTactic={() => {}}
        onRetreat={() => {}}
      />,
    );

    const pressBtn = screen.getByRole('button', { name: 'Press' });
    const steadyBtn = screen.getByRole('button', { name: 'Steady' });
    const guardBtn = screen.getByRole('button', { name: 'Guard' });
    const retreatBtn = screen.getByRole('button', { name: 'Retreat' });

    expect(pressBtn).toHaveAttribute('aria-pressed', 'false');
    expect(steadyBtn).toHaveAttribute('aria-pressed', 'true');
    expect(guardBtn).toHaveAttribute('aria-pressed', 'false');
    expect(retreatBtn).toBeInTheDocument();

    expect(screen.getByRole('img', { name: 'Health 4 of 6, armour 2' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Enemy health 8 of 8' })).toBeInTheDocument();

    const artStage = screen.getByTestId('combat-art-stage');
    expect(artStage.textContent ?? '').not.toMatch(/\d/);
    expect(within(artStage).getByLabelText(/Intent:/i)).toBeInTheDocument();
  });

  it('hides Retreat when allowRetreat is false and renders cleanly at 360, 390, and 768px widths', () => {
    const encounter = createEncounter(false);
    const state = startFight(encounter, createPlayer());

    for (const width of [360, 390, 768]) {
      Object.defineProperty(window, 'innerWidth', { value: width, configurable: true });
      const { unmount } = render(
        <CombatScreen
          encounter={encounter}
          fightState={state}
          resultCaption="Fight begins."
          onAdvanceBeat={() => {}}
          onSelectTactic={() => {}}
          onRetreat={() => {}}
        />,
      );
      expect(screen.queryByRole('button', { name: 'Retreat' })).not.toBeInTheDocument();
      expect(screen.getByTestId('combat-screen')).toBeInTheDocument();
      unmount();
    }
  });
});
