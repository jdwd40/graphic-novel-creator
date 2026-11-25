import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import playerThemeCss from '../PlayerTheme.css?raw';
import { createSeedStory } from '../../story/seed';
import { StoryPlayer } from '../StoryPlayer';

describe('Page-turn transitions and accessibility (#52)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defines a <300ms transition and disables motion when prefers-reduced-motion is set', () => {
    expect(playerThemeCss).toMatch(/animation:\s*pageTurnIn\s*220ms/);
    expect(playerThemeCss).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  });

  it('scrolls to top, moves focus to the new page heading, and never blocks choices', () => {
    const scrollSpy = vi.fn();
    window.scrollTo = scrollSpy;

    const story = createSeedStory();
    render(<StoryPlayer story={story} showTitleScreen={false} />);

    // Choose into Armory
    fireEvent.click(screen.getByRole('button', { name: /gear up at the watch armory/i }));
    expect(scrollSpy).toHaveBeenCalledWith(0, 0);
    const armoryHeading = screen.getByRole('heading', { name: 'Watch Armory' });
    expect(document.activeElement).toBe(armoryHeading);

    // Immediately click next choice into combat without any lock/delay
    fireEvent.click(screen.getByRole('button', { name: /step straight into the gatehouse/i }));
    const combatHeading = screen.getByRole('heading', { name: /Combat with Gatehouse Guard/i });
    expect(document.activeElement).toBe(combatHeading);
  });
});
