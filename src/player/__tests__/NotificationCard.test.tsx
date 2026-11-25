import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { applyStoryEffects, createPlaythrough } from '../../story/playthrough';
import { createSeedStory } from '../../story/seed';
import { StoryPlayer } from '../StoryPlayer';

describe('Item-found and gear-change cards (#50)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('queues structured cards with images, shows gear upgrades in words, and dismisses one at a time', () => {
    const story = createSeedStory();
    render(<StoryPlayer story={story} />);

    // First choice in seed story gives rusty_sword + padded_coat
    fireEvent.click(screen.getByRole('button', { name: /gear up at the watch armory/i }));

    // Front queued card is Rusty Sword (NO raw pipe-joined string)
    const firstCard = screen.getByTestId('player-notifications');
    expect(firstCard).toHaveTextContent('You found: Rusty Sword');
    expect(firstCard).toHaveTextContent('Equipped Rusty Sword');
    expect(firstCard.textContent ?? '').not.toContain('|');
    expect(screen.getByAltText('You found: Rusty Sword')).toBeInTheDocument();

    // Tap to dismiss reveals Padded Coat card
    fireEvent.click(firstCard);
    const secondCard = screen.getByTestId('player-notifications');
    expect(secondCard).toHaveTextContent('You found: Padded Coat');

    // Choices are not blocked while card is visible
    expect(screen.getByRole('button', { name: /step straight into the gatehouse/i })).toBeEnabled();

    // Dismissing second card clears notification area
    fireEvent.click(secondCard);
    expect(screen.queryByTestId('player-notifications')).not.toBeInTheDocument();
  });

  it('describes weapon upgrade in words and queues lost item and wound cards', () => {
    const story = createSeedStory();
    let pt = createPlaythrough(story);
    pt = applyStoryEffects(pt, story, [{ addItem: 'rusty_sword' }]);
    pt = applyStoryEffects(pt, story, [
      { addItem: 'steel_sword' },
      { removeItem: 'rusty_sword' },
      { addWound: 'Cracked rib', description: 'Breathing hurts.' },
    ]);

    render(<StoryPlayer story={story} initialPlaythrough={pt} />);

    const card1 = screen.getByTestId('player-notifications');
    expect(card1).toHaveTextContent('You found: Steel Sword');
    expect(card1).toHaveTextContent('Steel Sword replaces Rusty Sword');

    fireEvent.click(card1);
    expect(screen.getByTestId('player-notifications')).toHaveTextContent('Lost: Rusty Sword');

    fireEvent.click(screen.getByTestId('player-notifications'));
    expect(screen.getByTestId('player-notifications')).toHaveTextContent('Wound: Cracked rib');

    fireEvent.click(screen.getByTestId('player-notifications'));
    expect(screen.queryByTestId('player-notifications')).not.toBeInTheDocument();
  });
});
