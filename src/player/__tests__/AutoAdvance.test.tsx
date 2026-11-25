import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPlaythrough } from '../../story/playthrough';
import { createSeedStory } from '../../story/seed';
import {
  computeAutoAdvanceDelay,
  loadReaderSettings,
} from '../../story/settings';
import { StoryPlayer } from '../StoryPlayer';

describe('Auto-advance reader setting', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('defaults to off and does not advance without a tap', () => {
    const story = createSeedStory();
    const pt = {
      ...createPlaythrough(story),
      currentNodeId: 'enc_gatehouse',
    };
    render(<StoryPlayer story={story} initialPlaythrough={pt} />);

    fireEvent.click(screen.getByRole('button', { name: /reader menu/i }));
    const toggle = screen.getByLabelText(/auto-advance/i) as HTMLInputElement;
    expect(toggle.checked).toBe(false);

    act(() => {
      vi.advanceTimersByTime(15000);
    });
    expect(screen.getByRole('img', { name: 'Enemy health 8 of 8' })).toBeInTheDocument();
  });

  it('plays a fight untouched to its exit when auto-advance is enabled and persists across sessions', () => {
    const story = createSeedStory();
    const pt = {
      ...createPlaythrough(story),
      currentNodeId: 'enc_gatehouse',
      combat: {
        ...createPlaythrough(story).combat,
        weapon: { id: 'rusty_sword', name: 'Rusty Sword', damage: 2 },
        armour: { id: 'padded_coat', name: 'Padded Coat', buffer: 2 },
      },
    };
    render(<StoryPlayer story={story} initialPlaythrough={pt} />);

    fireEvent.click(screen.getByRole('button', { name: /reader menu/i }));
    fireEvent.click(screen.getByLabelText(/auto-advance/i));
    expect(loadReaderSettings().autoAdvance).toBe(true);

    // 4 beats * max 6000ms -> advancing 4 steps completes the fight untouched -> Continue goes to exit.
    for (let i = 0; i < 4; i++) {
      act(() => {
        vi.advanceTimersByTime(6000);
      });
    }
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByTestId('passage-view-passage_shrine')).toBeInTheDocument();

    // Persists across remount
    cleanup();
    render(<StoryPlayer story={story} />);
    fireEvent.click(screen.getByRole('button', { name: /reader menu/i }));
    expect((screen.getByLabelText(/auto-advance/i) as HTMLInputElement).checked).toBe(true);
  });

  it('keeps longer captions on screen longer than short ones and resets delay on tactic touch', () => {
    const shortDelay = computeAutoAdvanceDelay('Short.', 'Tell.');
    const longDelay = computeAutoAdvanceDelay(
      'This is a much longer comic panel caption describing a dramatic clash of steel.',
      'And a detailed tell caption describing the looming overhead swing.',
    );
    expect(longDelay).toBeGreaterThan(shortDelay);

    const story = createSeedStory();
    const pt = {
      ...createPlaythrough(story),
      currentNodeId: 'enc_gatehouse',
      combat: {
        ...createPlaythrough(story).combat,
        weapon: { id: 'rusty_sword', name: 'Rusty Sword', damage: 2 },
        armour: { id: 'padded_coat', name: 'Padded Coat', buffer: 2 },
      },
    };
    render(<StoryPlayer story={story} initialPlaythrough={pt} />);
    fireEvent.click(screen.getByRole('button', { name: /reader menu/i }));
    fireEvent.click(screen.getByLabelText(/auto-advance/i));

    // Advance most of the delay, then touch tactic bar to restart timer.
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Press' }));
    act(() => {
      vi.advanceTimersByTime(500);
    });
    // Still on beat 0 because timer restarted!
    expect(screen.getByRole('img', { name: 'Enemy health 8 of 8' })).toBeInTheDocument();
  });
});
