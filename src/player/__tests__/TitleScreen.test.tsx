import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { StoryMapBuilder } from '../../builder/StoryMapBuilder';
import { loadPlaythrough } from '../../story/playthrough';
import { createSeedStory } from '../../story/seed';
import type { Story } from '../../story/types';
import { StoryPlayer } from '../StoryPlayer';

describe('Title screen with cover art (#51)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows cover art, title, and blurb by default, and renders typographic cover when no image is set', () => {
    const story = createSeedStory();
    render(<StoryPlayer story={story} />);

    expect(screen.getByTestId('title-screen')).toBeInTheDocument();
    expect(screen.getByTestId('title-cover-img')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'The Iron Bell' })).toBeInTheDocument();
    expect(screen.getByText(/Rain batters the ancient belfry/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument();

    cleanup();
    render(
      <StoryPlayer
        story={{ ...story, coverImage: undefined }}
      />,
    );
    expect(screen.getByTestId('title-typographic-cover')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'The Iron Bell' })).toBeInTheDocument();
  });

  it('offers Continue to resume a saved fight mid-combat, and confirms before overwriting on New game', () => {
    const story = createSeedStory();
    render(<StoryPlayer story={story} />);

    // Play into the Gatehouse encounter and advance 1 beat
    fireEvent.click(screen.getByRole('button', { name: 'New game' }));
    fireEvent.click(screen.getByRole('button', { name: /gear up at the watch armory/i }));
    fireEvent.click(screen.getByRole('button', { name: /step straight into the gatehouse/i }));
    fireEvent.click(screen.getByTestId('combat-tap-zone'));
    expect(loadPlaythrough(story.id)?.activeFight?.fight.beatNumber).toBe(1);

    // Reload -> Title screen shows Continue & New game
    cleanup();
    render(<StoryPlayer story={story} />);
    expect(screen.getByTestId('title-screen')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();

    // New game requires confirmation before overwriting
    fireEvent.click(screen.getByRole('button', { name: 'New game' }));
    expect(screen.getByRole('alertdialog', { name: /confirm new game/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    // Continue resumes the mid-fight combat at beat 1!
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByTestId('combat-screen')).toBeInTheDocument();
    expect(loadPlaythrough(story.id)?.activeFight?.fight.beatNumber).toBe(1);

    // Confirming New game resets back to start passage
    cleanup();
    render(<StoryPlayer story={story} />);
    fireEvent.click(screen.getByRole('button', { name: 'New game' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm new game' }));
    expect(screen.getByTestId('passage-view-passage_intro')).toBeInTheDocument();
  });

  it('allows editing story title and blurb from Story settings in the builder', () => {
    function Harness() {
      const [story, setStory] = useState<Story>(() => createSeedStory());
      return <StoryMapBuilder story={story} onStoryChange={setStory} />;
    }
    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: /story settings/i }));
    fireEvent.change(screen.getByLabelText(/story title/i), {
      target: { value: 'Shadow of the Belfry' },
    });
    fireEvent.change(screen.getByLabelText(/story blurb/i), {
      target: { value: 'A revised dusk edition.' },
    });
    expect(screen.getByTestId('story-settings-panel')).toBeInTheDocument();
  });
});
