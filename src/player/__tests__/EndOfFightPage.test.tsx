import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { createPlaythrough, loadPlaythrough } from '../../story/playthrough';
import { createSeedStory } from '../../story/seed';
import type { EncounterNode } from '../../story/types';
import { StoryPlayer } from '../StoryPlayer';

describe('EndOfFightPage comic strip', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows every beat and moment choice in order, survives reload mid-fight, and navigates on Continue', () => {
    const base = createSeedStory();
    const brute = base.nodes.enc_brute as EncounterNode;
    const story = {
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
    const pt = {
      ...createPlaythrough(story),
      currentNodeId: 'enc_brute',
      combat: {
        ...createPlaythrough(story).combat,
        weapon: { id: 'steel_sword', name: 'Steel Sword', damage: 3 },
        armour: { id: 'mail', name: 'Mail', buffer: 4 },
      },
    };

    Object.defineProperty(window, 'innerWidth', { value: 360, configurable: true });
    render(<StoryPlayer story={story} initialPlaythrough={pt} />);

    // Play 2 beats, then reload mid-fight
    fireEvent.click(screen.getByTestId('combat-tap-zone'));
    fireEvent.click(screen.getByTestId('combat-tap-zone'));

    cleanup();
    render(<StoryPlayer story={story} showTitleScreen={false} />);

    // Play beat 3 to trigger the moment
    fireEvent.click(screen.getByTestId('combat-tap-zone'));
    expect(screen.getByTestId('moment-choices-panel')).toBeInTheDocument();

    // Choose "Demand surrender." -> enters EndOfFightPage
    fireEvent.click(screen.getByRole('button', { name: 'Demand surrender.' }));

    const endPage = screen.getByTestId('end-of-fight-page');
    expect(endPage).toBeInTheDocument();

    const strip = screen.getByTestId('end-of-fight-strip');
    const panels = within(strip).getAllByRole('listitem');
    // 3 beats + 1 moment = 4 panels in chronological order
    expect(panels).toHaveLength(4);
    expect(panels[0]).toHaveTextContent(/./);
    expect(panels[1]).toHaveTextContent(/./);
    expect(panels[2]).toHaveTextContent(/./);
    expect(panels[3]).toHaveTextContent(/falls to one knee/i);
    expect(panels[3]).toHaveTextContent(/Demand surrender\./i);

    // Reloading on the end-of-fight page still preserves the complete strip
    cleanup();
    render(<StoryPlayer story={story} showTitleScreen={false} />);
    expect(within(screen.getByTestId('end-of-fight-strip')).getAllByRole('listitem')).toHaveLength(
      4,
    );

    // Continue navigates to the passage wired to the surrender exit and clears activeFight
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByTestId('passage-view-passage_victory')).toBeInTheDocument();
    expect(loadPlaythrough(story.id)?.activeFight).toBeNull();
  });
});
