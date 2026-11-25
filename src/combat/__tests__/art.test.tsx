import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { selectEncounterArt } from '../art';
import { advanceBeat, startFight } from '../resolver';
import type { Encounter, PlayerCombatState } from '../types';
import { ArtVariantsEditor } from '../../builder/ArtVariantsEditor';
import { createDefaultEncounterNode } from '../../builder/graphUtils';
import { CombatScreen } from '../../player/CombatScreen';

function makePlayer(health = 6): PlayerCombatState {
  return {
    health,
    maxHealth: 6,
    weapon: { id: 'w', name: 'Sword', damage: 2 },
    armour: { id: 'a', name: 'Mail', buffer: 4 },
    wounds: [],
  };
}

function makeEncounter(withVariants = true): Encounter {
  return {
    type: 'encounter',
    enemy: {
      name: 'Hammer Brute',
      image: 'base.png',
      toughness: 'tough',
      health: 12,
      hit: 2,
    },
    behaviour: 'brute',
    pattern: ['heavy', 'strike'],
    altPattern: null,
    tellClarity: 'clear',
    art: withVariants
      ? {
          open: 'open.png',
          enemyWounded: 'enemy-wounded.png',
          playerWounded: 'player-wounded.png',
        }
      : undefined,
    phases: withVariants ? [{ healthAtMost: 4, pattern: ['strike'], image: 'phase2.png' }] : [],
    allowRetreat: true,
    exits: {
      victory: { effects: [] },
      defeat: { effects: [] },
      retreat: { effects: [] },
    },
  };
}

describe('art variants', () => {
  it('switches to Open art on Open beats and returns to base afterwards', () => {
    const enc = makeEncounter(true);
    let state = startFight(enc, makePlayer());
    expect(selectEncounterArt(enc, state)).toBe('base.png');

    // Guard heavy -> pendingOpen = true -> next move is Open!
    state = advanceBeat(state, enc, 'guard').state;
    expect(selectEncounterArt(enc, state)).toBe('open.png');

    // Resolve Open beat -> returns to normal pattern ('strike'), base art returns
    state = advanceBeat(state, enc, 'press').state;
    expect(selectEncounterArt(enc, state)).toBe('base.png');
  });

  it('shows base image throughout when no variants are set', () => {
    const enc = makeEncounter(false);
    let state = startFight(enc, makePlayer(2));
    expect(selectEncounterArt(enc, state)).toBe('base.png');
    state = advanceBeat(state, enc, 'guard').state;
    expect(selectEncounterArt(enc, state)).toBe('base.png');
    state = advanceBeat(state, enc, 'press').state;
    expect(selectEncounterArt(enc, state)).toBe('base.png');
  });

  it('follows priority: phase art -> Open -> enemy wounded -> player wounded -> base', () => {
    const enc = makeEncounter(true);
    const baseState = startFight(enc, makePlayer(2));
    expect(selectEncounterArt(enc, baseState)).toBe('player-wounded.png');

    const enemyWounded = { ...baseState, enemyHealth: 6 };
    expect(selectEncounterArt(enc, enemyWounded)).toBe('enemy-wounded.png');

    const openState = { ...enemyWounded, pendingOpen: true };
    expect(selectEncounterArt(enc, openState)).toBe('open.png');

    const phaseState = { ...openState, phase: 1 };
    expect(selectEncounterArt(enc, phaseState)).toBe('phase2.png');
  });

  it('renders variant controls in inspector and swaps art inside fixed-stage CombatScreen', async () => {
    function EditorHarness() {
      const [enc, setEnc] = useState<Encounter>(createDefaultEncounterNode('e1').encounter);
      return <ArtVariantsEditor encounter={enc} storyId="art-test" onUpdate={setEnc} />;
    }
    render(<EditorHarness />);
    fireEvent.click(screen.getByText(/Art variants/i));
    const file = new File(['<svg xmlns="http://www.w3.org/2000/svg"/>'], 'new-open.svg', {
      type: 'image/svg+xml',
    });
    fireEvent.change(screen.getByLabelText('Upload Enemy Open art'), { target: { files: [file] } });
    await waitFor(() => {
      expect(screen.getByAltText('Enemy Open art preview')).toBeInTheDocument();
    });

    const enc = makeEncounter(true);
    const state = { ...startFight(enc, makePlayer()), pendingOpen: true };
    render(
      <CombatScreen
        encounter={enc}
        fightState={state}
        resultCaption="Staggered!"
        onAdvanceBeat={() => {}}
        onSelectTactic={() => {}}
        onRetreat={() => {}}
      />,
    );
    expect(screen.getByRole('img', { name: 'Hammer Brute' })).toHaveAttribute('src', 'open.png');
    expect(screen.getByTestId('combat-art-stage')).toHaveClass('combat-art-stage');
  });
});
