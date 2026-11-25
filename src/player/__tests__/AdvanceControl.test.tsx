import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GEAR_TIERS } from '../../combat/constants';
import { startFight } from '../../combat/resolver';
import { createPlaythrough } from '../../story/playthrough';
import { createSeedStory } from '../../story/seed';
import type { EncounterNode } from '../../story/types';
import { CombatScreen } from '../CombatScreen';
import { StoryPlayer } from '../StoryPlayer';

describe('Visible advance control & keyboard advance (#57)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('finishes a fight using only the Next beat button and hides the tap hint after 3 beats', () => {
    const story = createSeedStory();
    const t1 = GEAR_TIERS[0];
    const pt = {
      ...createPlaythrough(story),
      currentNodeId: 'enc_gatehouse',
      combat: {
        health: 6,
        maxHealth: 6,
        weapon: { id: 'w1', name: t1.weaponName, damage: t1.damage },
        armour: { id: 'a1', name: t1.armourName, buffer: t1.buffer },
        wounds: [],
      },
    };
    render(<StoryPlayer story={story} initialPlaythrough={pt} />);

    // Visible hint on initial beat
    expect(screen.getByTestId('combat-tap-hint')).toBeInTheDocument();

    // Advance 3 beats with Next beat button
    for (let i = 0; i < 3; i++) {
      fireEvent.click(screen.getByTestId('combat-next-btn'));
    }

    // Hint automatically hides once beatNumber >= 3
    expect(screen.queryByTestId('combat-tap-hint')).not.toBeInTheDocument();

    // 4th click finishes the encounter and opens EndOfFightPage
    fireEvent.click(screen.getByTestId('combat-next-btn'));
    expect(screen.getByTestId('end-of-fight-page')).toBeInTheDocument();
  });

  it('advances via Space/Enter when canvas is unfocused, ignores when a tactic button holds focus, and disables Next beat during a moment', () => {
    const onAdvanceBeat = vi.fn();
    const story = createSeedStory();
    const brute = (story.nodes.enc_brute as EncounterNode).encounter;
    const t1 = GEAR_TIERS[0];
    const baseState = startFight(brute, {
      health: 6,
      maxHealth: 6,
      weapon: { id: 'w1', name: t1.weaponName, damage: t1.damage },
      armour: { id: 'a1', name: t1.armourName, buffer: t1.buffer },
      wounds: [],
    });

    const { rerender } = render(
      <CombatScreen
        encounter={brute}
        fightState={baseState}
        resultCaption="The brute squares up."
        onAdvanceBeat={onAdvanceBeat}
        onSelectTactic={() => {}}
        onRetreat={() => {}}
      />,
    );

    // Space & Enter advance when body has focus
    fireEvent.keyDown(window, { key: ' ' });
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onAdvanceBeat).toHaveBeenCalledTimes(2);

    // Focusing a tactic button and pressing Space/Enter must NOT advance a beat
    const pressBtn = screen.getByRole('button', { name: 'Press' });
    pressBtn.focus();
    fireEvent.keyDown(pressBtn, { key: ' ' });
    fireEvent.keyDown(pressBtn, { key: 'Enter' });
    expect(onAdvanceBeat).toHaveBeenCalledTimes(2);

    // Opening a moment disables Next beat and blocks keyboard advance
    (document.activeElement as HTMLElement | null)?.blur?.();
    rerender(
      <CombatScreen
        encounter={brute}
        fightState={{ ...baseState, pendingMomentQueue: [0] }}
        resultCaption="Moment!"
        onAdvanceBeat={onAdvanceBeat}
        onSelectTactic={() => {}}
        onRetreat={() => {}}
      />,
    );

    expect(screen.getByTestId('combat-next-btn')).toBeDisabled();
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onAdvanceBeat).toHaveBeenCalledTimes(2);
  });
});
