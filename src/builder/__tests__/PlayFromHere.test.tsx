import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../App';
import { createPlaythrough, getPlaythroughStorageKey, savePlaythrough } from '../../story/playthrough';
import { openDemoStory } from '../../story/store';

describe('Play from here (#62)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('plays an encounter with chosen gear without overwriting the real saved playthrough and returns to the same node', () => {
    const demo = openDemoStory();
    const realSave = {
      ...createPlaythrough(demo, 'real_pt'),
      currentNodeId: 'passage_armory',
      flags: { untouched_real_flag: true },
    };
    savePlaythrough(realSave);
    const savedRawBefore = localStorage.getItem(getPlaythroughStorageKey(demo.id));

    render(<App />);

    // Open builder on the seeded story
    fireEvent.click(screen.getByRole('button', { name: 'Story Builder' }));

    // Select the Brute encounter node
    fireEvent.click(screen.getByTestId('encounter-node-enc_brute'));
    expect(screen.getByRole('heading', { name: 'Hammer Brute' })).toBeInTheDocument();

    // Open Play from here setup modal and choose Steel Sword & Mail Hauberk
    fireEvent.click(screen.getByRole('button', { name: 'Play from here' }));
    const modal = screen.getByTestId('play-from-here-modal');
    expect(modal).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/starting weapon/i), {
      target: { value: 'steel_sword' },
    });
    fireEvent.change(screen.getByLabelText(/starting armour/i), {
      target: { value: 'mail_hauberk' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Start test play' }));

    // Launches straight into the encounter with test banner and chosen armour
    expect(screen.getByTestId('test-play-banner')).toBeInTheDocument();
    expect(screen.getByTestId('combat-screen')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Health 6 of 6, armour 4' })).toBeInTheDocument();

    // Advance one beat during the test run
    fireEvent.click(screen.getByTestId('combat-next-btn'));

    // Return to builder re-selects the exact node (enc_brute)
    fireEvent.click(screen.getByRole('button', { name: 'Back to builder' }));
    expect(screen.getByTestId('encounter-node-enc_brute')).toHaveClass('is-selected');
    expect(screen.getByRole('heading', { name: 'Hammer Brute' })).toBeInTheDocument();

    // Real reader save in localStorage is completely untouched
    expect(localStorage.getItem(getPlaythroughStorageKey(demo.id))).toBe(savedRawBefore);
  });
});
