import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { createPlaythrough, loadPlaythrough } from '../../story/playthrough';
import { createSeedStory } from '../../story/seed';
import type { EncounterNode } from '../../story/types';
import { StoryPlayer } from '../StoryPlayer';

describe('Moment choices on the combat screen', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  function setupBruteStory() {
    const base = createSeedStory();
    const brute = base.nodes.enc_brute as EncounterNode;
    return {
      ...base,
      nodes: {
        ...base.nodes,
        enc_brute: {
          ...brute,
          exitTargets: {
            ...brute.exitTargets,
            surrender: 'passage_victory',
          },
        },
      },
    };
  }

  it('replaces tactic bar with story-styled choices, blocks art taps, and survives reload', () => {
    const story = setupBruteStory();
    const pt = {
      ...createPlaythrough(story),
      currentNodeId: 'enc_brute',
      combat: {
        ...createPlaythrough(story).combat,
        weapon: { id: 'steel_sword', name: 'Steel Sword', damage: 3 },
        armour: { id: 'mail', name: 'Mail', buffer: 4 },
      },
    };
    render(<StoryPlayer story={story} initialPlaythrough={pt} />);

    // 3 Steady beats drop Hammer Brute 12 -> 3, triggering the moment
    fireEvent.click(screen.getByTestId('combat-tap-zone'));
    fireEvent.click(screen.getByTestId('combat-tap-zone'));
    fireEvent.click(screen.getByTestId('combat-tap-zone'));

    expect(screen.getByTestId('moment-choices-panel')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Steady' })).not.toBeInTheDocument();
    expect(screen.getByTestId('combat-result-caption')).toHaveTextContent(
      /falls to one knee/i,
    );

    const finishBtn = screen.getByRole('button', { name: 'Finish it.' });
    const surrenderBtn = screen.getByRole('button', { name: 'Demand surrender.' });
    expect(finishBtn).toHaveClass('story-choice-btn');
    expect(surrenderBtn).toHaveClass('story-choice-btn');

    // Tapping art while moment is open does not advance beat
    fireEvent.click(screen.getByTestId('combat-tap-zone'));
    expect(loadPlaythrough(story.id)?.activeFight?.fight.beatNumber).toBe(3);

    // Reloading keeps the moment open
    cleanup();
    render(<StoryPlayer story={story} />);
    expect(screen.getByTestId('moment-choices-panel')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Demand surrender.' })).toBeInTheDocument();

    // Choosing Demand surrender exits to passage_victory and applies surrender flag
    fireEvent.click(screen.getByRole('button', { name: 'Demand surrender.' }));
    expect(screen.getByTestId('passage-view-passage_victory')).toBeInTheDocument();
    expect(loadPlaythrough(story.id)?.flags.brute_spared).toBe(true);
  });

  it('returns to the tactic bar and next tell when Continue is chosen', () => {
    const story = setupBruteStory();
    const pt = {
      ...createPlaythrough(story),
      currentNodeId: 'enc_brute',
      combat: {
        ...createPlaythrough(story).combat,
        weapon: { id: 'steel_sword', name: 'Steel Sword', damage: 3 },
        armour: { id: 'mail', name: 'Mail', buffer: 4 },
      },
    };
    render(<StoryPlayer story={story} initialPlaythrough={pt} />);

    for (let i = 0; i < 3; i++) {
      fireEvent.click(screen.getByTestId('combat-tap-zone'));
    }

    fireEvent.click(screen.getByRole('button', { name: 'Finish it.' }));
    expect(screen.queryByTestId('moment-choices-panel')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Steady' })).toBeInTheDocument();
  });
});
