import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../App';
import { createPlaythrough } from '../../story/playthrough';
import { createSeedStory } from '../../story/seed';
import { StoryPlayer } from '../StoryPlayer';

describe('ReaderHud (#47)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('hides the app header in play mode and shows no debug stats or abbreviations while reading', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /^play$/i }));

    expect(
      screen.queryByRole('heading', { name: /graphic novel creator/i }),
    ).not.toBeInTheDocument();

    const hud = screen.getByTestId('reader-hud');
    expect(hud).toBeInTheDocument();
    expect(screen.getByTestId('story-player').textContent ?? '').not.toMatch(/\b(dmg|buf)\b/i);
    expect(screen.getByTestId('story-player').textContent ?? '').not.toMatch(/Health:\s*\d+\/\d+/i);

    fireEvent.click(screen.getByRole('button', { name: /exit to builder/i }));
    expect(
      screen.getByRole('heading', { name: /graphic novel creator/i }),
    ).toBeInTheDocument();
  });

  it('syncs HUD health pips with combat pips on every beat and requires confirmation to restart', () => {
    const story = createSeedStory();
    const pt = {
      ...createPlaythrough(story),
      currentNodeId: 'enc_brute',
      combat: {
        ...createPlaythrough(story).combat,
        weapon: { id: 'rusty_sword', name: 'Rusty Sword', damage: 2 },
        armour: { id: 'padded_coat', name: 'Padded Coat', buffer: 2 },
      },
    };
    render(<StoryPlayer story={story} initialPlaythrough={pt} />);

    // Beat 1 + Beat 2
    fireEvent.click(screen.getByTestId('combat-tap-zone'));
    fireEvent.click(screen.getByTestId('combat-tap-zone'));

    const hud = screen.getByTestId('reader-hud');
    expect(within(hud).getByRole('img', { name: 'Reader health 2 of 6, armour 0' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Health 2 of 6, armour 0' })).toBeInTheDocument();

    // Restart requires confirmation before resetting back to passage_intro
    fireEvent.click(screen.getByRole('button', { name: /reader menu/i }));
    fireEvent.click(screen.getByRole('button', { name: /restart story/i }));
    expect(screen.getByRole('alertdialog', { name: /confirm restart/i })).toBeInTheDocument();
    // Still in fight until confirmed
    expect(screen.getByTestId('combat-screen')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /confirm restart/i }));
    expect(screen.getByTestId('passage-view-passage_intro')).toBeInTheDocument();
  });
});
