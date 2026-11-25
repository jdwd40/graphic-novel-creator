import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createSeedStory } from '../../story/seed';
import { StoryMapBuilder } from '../StoryMapBuilder';

describe('Readable node cards with thumbnails (#59)', () => {
  it('renders passage thumbnails, larger titles, Start/Ending badges without selection, and >=16px handles', () => {
    const story = createSeedStory();
    render(<StoryMapBuilder story={story} onStoryChange={() => {}} />);

    // Start passage shows thumbnail and Start marker immediately
    const startCard = screen.getByTestId('passage-node-passage_intro');
    expect(startCard).toHaveClass('story-node--start');
    expect(within(startCard).getByText('Start')).toBeInTheDocument();
    expect(screen.getByTestId('passage-thumb-passage_intro')).toBeInTheDocument();

    // Ending passages show Ending marker without selecting them
    const victoryCard = screen.getByTestId('passage-node-passage_victory');
    expect(victoryCard).toHaveClass('story-node--ending');
    expect(within(victoryCard).getByText('Ending')).toBeInTheDocument();

    // Handles are >= 16px and clearly labelled
    const incomingHandle = within(startCard).getByLabelText('Incoming story link');
    expect(incomingHandle).toHaveStyle({ width: '16px', height: '16px' });

    const choiceHandle = within(startCard).getByLabelText(/Choice Gear up at the watch armory/i);
    expect(choiceHandle).toHaveStyle({ width: '16px', height: '16px' });

    // Encounter cards render enemy image, toughness badge, name, and exit handles >= 16px
    const encCard = screen.getByTestId('encounter-node-enc_gatehouse');
    expect(within(encCard).getByAltText('Gatehouse Guard')).toBeInTheDocument();
    expect(within(encCard).getByLabelText('Victory exit')).toHaveStyle({
      width: '16px',
      height: '16px',
    });
  });
});
