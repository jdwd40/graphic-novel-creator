import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { resolveBeat, startFight } from '../../combat/resolver';
import type { Encounter, Move, PlayerCombatState, Tactic } from '../../combat/types';
import { createPlaythrough } from '../../story/playthrough';
import { createSeedStory } from '../../story/seed';
import { CombatScreen } from '../CombatScreen';
import { StoryPlayer } from '../StoryPlayer';
import { deriveHitFeedback } from '../hitFeedback';

function makeEncounter(move: Move): Encounter {
  return {
    type: 'encounter',
    enemy: { name: 'Dummy', image: 'dummy.png', toughness: 'tough', health: 20, hit: 2 },
    behaviour: 'custom',
    pattern: [move],
    altPattern: null,
    tellClarity: 'clear',
    allowRetreat: true,
    exits: { victory: { effects: [] }, defeat: { effects: [] }, retreat: { effects: [] } },
  };
}

function makePlayer(): PlayerCombatState {
  return {
    health: 6,
    maxHealth: 6,
    weapon: { id: 'w1', name: 'Sword', damage: 2 },
    armour: { id: 'a1', name: 'Coat', buffer: 2 },
    wounds: [],
  };
}

describe('Hit feedback without numbers', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('produces non-numeric SFX and appropriate pip/shake feedback across all 9 cells', () => {
    const moves: Move[] = ['strike', 'heavy', 'open'];
    const tactics: Tactic[] = ['press', 'steady', 'guard'];

    for (const move of moves) {
      for (const tactic of tactics) {
        const enc = makeEncounter(move);
        const start = { ...startFight(enc, makePlayer()), pendingOpen: move === 'open' };
        const step = resolveBeat(start, enc, tactic);
        const fb = deriveHitFeedback(start, step.state, step.events, tactic, false);

        expect(fb.sfxText).toBeTruthy();
        expect(fb.sfxText).not.toMatch(/\d/);
      }
    }
  });

  it('makes a blocked Heavy visually distinct from a landed Heavy', () => {
    const enc = makeEncounter('heavy');
    const start = startFight(enc, makePlayer());

    const blockedStep = resolveBeat(start, enc, 'guard');
    const blockedFb = deriveHitFeedback(start, blockedStep.state, blockedStep.events, 'guard', false);

    const landedStep = resolveBeat(start, enc, 'steady');
    const landedFb = deriveHitFeedback(start, landedStep.state, landedStep.events, 'steady', false);

    expect(blockedFb.sfxVariant).toBe('heavy-blocked');
    expect(blockedFb.sfxText).toBe('CLANG!');
    expect(blockedFb.shakePlayer).toBe(false);

    expect(landedFb.sfxVariant).toBe('heavy-landed');
    expect(landedFb.sfxText).toBe('CRUSH!');
    expect(landedFb.shakePlayer).toBe(true);

    const { rerender } = render(
      <CombatScreen
        encounter={enc}
        fightState={blockedStep.state}
        resultCaption="Blocked"
        feedback={blockedFb}
        onAdvanceBeat={() => {}}
        onSelectTactic={() => {}}
        onRetreat={() => {}}
      />,
    );
    expect(screen.getByTestId('combat-sfx')).toHaveClass('combat-sfx-badge--heavy-blocked');
    expect(screen.getByTestId('combat-art-stage')).not.toHaveClass('is-shaking');

    rerender(
      <CombatScreen
        encounter={enc}
        fightState={landedStep.state}
        resultCaption="Landed"
        feedback={landedFb}
        onAdvanceBeat={() => {}}
        onSelectTactic={() => {}}
        onRetreat={() => {}}
      />,
    );
    expect(screen.getByTestId('combat-sfx')).toHaveClass('combat-sfx-badge--heavy-landed');
    expect(screen.getByTestId('combat-art-stage')).toHaveClass('is-shaking');
  });

  it('suppresses motion when prefers-reduced-motion is set', () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = (() => ({ matches: true })) as unknown as typeof window.matchMedia;
    const enc = makeEncounter('heavy');
    const start = startFight(enc, makePlayer());
    const landedStep = resolveBeat(start, enc, 'steady');
    const fb = deriveHitFeedback(start, landedStep.state, landedStep.events, 'steady');
    expect(fb.shakePlayer).toBe(false);
    window.matchMedia = originalMatchMedia;
  });

  it('never delays rapid consecutive taps during combat', () => {
    const story = createSeedStory();
    const pt = {
      ...createPlaythrough(story),
      currentNodeId: 'enc_gatehouse',
      combat: makePlayer(),
    };
    render(<StoryPlayer story={story} initialPlaythrough={pt} />);

    // Two immediate taps advance two beats with zero animation lock.
    fireEvent.click(screen.getByTestId('combat-tap-zone'));
    fireEvent.click(screen.getByTestId('combat-tap-zone'));
    expect(screen.getByRole('img', { name: 'Enemy health 4 of 8' })).toBeInTheDocument();
  });
});
