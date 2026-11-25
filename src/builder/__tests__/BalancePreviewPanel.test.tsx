import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BEHAVIOUR_PRESETS, TOUGHNESS_PRESETS } from '../../combat/constants';
import type { BehaviourPreset, Encounter, ToughnessPreset } from '../../combat/types';
import { BalancePreviewPanel } from '../BalancePreviewPanel';

function buildEncounter(
  toughness: ToughnessPreset,
  behaviour: Exclude<BehaviourPreset, 'custom'>,
  overrides: Partial<Encounter> = {},
): Encounter {
  const t = TOUGHNESS_PRESETS[toughness];
  return {
    type: 'encounter',
    enemy: {
      name: `${toughness} ${behaviour}`,
      image: 'enemy.png',
      toughness,
      health: t.health,
      hit: t.hit,
    },
    behaviour,
    pattern: [...BEHAVIOUR_PRESETS[behaviour]],
    altPattern: null,
    tellClarity: t.tellClarity,
    allowRetreat: true,
    exits: {
      victory: { effects: [] },
      defeat: { effects: [] },
      retreat: { effects: [] },
    },
    ...overrides,
  };
}

describe('BalancePreviewPanel', () => {
  it('shows the exact four results from the spec balance table', () => {
    const weak = buildEncounter('weak', 'skirmisher');
    const { rerender } = render(<BalancePreviewPanel encounter={weak} />);
    const row1Weak = screen.getByRole('row', { name: /Tier 1/i });
    expect(within(row1Weak).getAllByText('Wins in 3 beats, no health lost')).toHaveLength(2);

    const standard = buildEncounter('standard', 'brawler');
    rerender(<BalancePreviewPanel encounter={standard} />);
    const row1Std = screen.getByRole('row', { name: /Tier 1/i });
    expect(within(row1Std).getByText('Wins in 4 beats, loses 2 health')).toBeInTheDocument();
    expect(within(row1Std).getByText('Wins in 4 beats, no health lost')).toBeInTheDocument();

    const tough = buildEncounter('tough', 'brute');
    rerender(<BalancePreviewPanel encounter={tough} />);
    const row1Tough = screen.getByRole('row', { name: /Tier 1/i });
    expect(within(row1Tough).getByText('Defeated on beat 3')).toBeInTheDocument();
    expect(within(row1Tough).getByText('Wins in 6 beats, loses 2 health')).toBeInTheDocument();

    const row2Tough = screen.getByRole('row', { name: /Tier 2/i });
    expect(within(row2Tough).getByText('Wins in 4 beats, loses 4 health')).toBeInTheDocument();
    expect(within(row2Tough).getByText('Wins in 4 beats, no health lost')).toBeInTheDocument();
  });

  it('updates live when encounter props change and triggers each warning appropriately', () => {
    const standard = buildEncounter('standard', 'brawler');
    const { rerender } = render(<BalancePreviewPanel encounter={standard} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    // High-hit, high-health non-boss triggers all three warnings.
    const overtuned = buildEncounter('tough', 'brute', {
      enemy: {
        name: 'Impossible Guard',
        image: 'guard.png',
        toughness: 'tough',
        health: 30,
        hit: 5,
      },
    });
    rerender(<BalancePreviewPanel encounter={overtuned} />);
    const alert = screen.getByRole('alert');
    expect(within(alert).getByText(/Autopilot is defeated at every gear tier/i)).toBeInTheDocument();
    expect(
      within(alert).getByText(/Careful play is defeated at one or more gear tiers/i),
    ).toBeInTheDocument();
    expect(within(alert).getByText(/Non-boss fight runs longer than 6 beats/i)).toBeInTheDocument();
  });

  it('provides accessible table headers and text-only results', () => {
    render(<BalancePreviewPanel encounter={buildEncounter('standard', 'brawler')} />);
    expect(screen.getByRole('columnheader', { name: /Gear tier/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Autopilot/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Careful/i })).toBeInTheDocument();
  });
});
