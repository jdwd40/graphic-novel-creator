import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { createPlaythrough } from '../../story/playthrough';
import { createSeedStory } from '../../story/seed';
import { setExitTarget } from '../../story/store';
import { StoryPlayer } from '../StoryPlayer';

describe('StoryPlayer combat beat flow and exits', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('wins the seeded Standard encounter with tier 1 gear by tapping on Steady and persists lost health', () => {
    const story = createSeedStory();
    render(<StoryPlayer story={story} />);

    // Intro -> Armory (equips Tier 1 Rusty Sword & Padded Coat)
    fireEvent.click(screen.getByRole('button', { name: /gear up at the watch armory/i }));
    // Armory -> Gatehouse Guard (Standard Brawler)
    fireEvent.click(screen.getByRole('button', { name: /step straight into the gatehouse/i }));

    expect(screen.getByTestId('combat-screen')).toBeInTheDocument();

    // 4 taps on Steady win Standard Brawler with 2 health lost -> health 4/6
    for (let i = 0; i < 4; i++) {
      fireEvent.click(screen.getByTestId('combat-tap-zone'));
    }

    expect(screen.getByTestId('passage-view-passage_shrine')).toBeInTheDocument();
    expect(screen.getByTestId('player-hp-summary')).toHaveTextContent('Health: 4/6');

    // Entering next fight refills buffer to full (mail_hauberk = 4 after shrine choice, or test without rest).
    fireEvent.click(screen.getByRole('button', { name: /rest by the hearth/i }));
    expect(screen.getByRole('img', { name: 'Health 6 of 6, armour 4' })).toBeInTheDocument();
  });

  it('arrives at the Defeat passage with 1 health when defeated by a Tough encounter', () => {
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

    // Tough Brute defeats tier 1 Steady on beat 3
    for (let i = 0; i < 3; i++) {
      fireEvent.click(screen.getByTestId('combat-tap-zone'));
    }

    expect(screen.getByTestId('passage-view-passage_defeat_cell')).toBeInTheDocument();
    expect(screen.getByTestId('player-hp-summary')).toHaveTextContent('Health: 1/5');
  });

  it('arrives at the Retreat passage after one enemy Strike when Retreat is pressed', () => {
    const story = createSeedStory();
    const pt = {
      ...createPlaythrough(story),
      currentNodeId: 'enc_gatehouse',
      combat: {
        ...createPlaythrough(story).combat,
        weapon: { id: 'rusty_sword', name: 'Rusty Sword', damage: 2 },
        armour: null,
      },
    };
    render(<StoryPlayer story={story} initialPlaythrough={pt} />);

    fireEvent.click(screen.getByRole('button', { name: 'Retreat' }));

    expect(screen.getByTestId('passage-view-passage_retreat_alley')).toBeInTheDocument();
    expect(screen.getByTestId('player-hp-summary')).toHaveTextContent('Health: 5/6');
  });

  it('keeps health lost in the next passage and refills buffer on a subsequent encounter', () => {
    const story = setExitTarget(createSeedStory(), 'enc_gatehouse', 'victory', 'enc_brute');
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

    // Win Gatehouse Guard (loses 2 HP and empties buffer of 2)
    for (let i = 0; i < 4; i++) {
      fireEvent.click(screen.getByTestId('combat-tap-zone'));
    }

    // Arrives immediately at Hammer Brute with 4 health and FULL buffer of 2 again!
    expect(screen.getByRole('img', { name: 'Health 4 of 6, armour 2' })).toBeInTheDocument();
  });

  it('shows a plain message instead of crashing on an unwired exit', () => {
    const story = setExitTarget(createSeedStory(), 'enc_gatehouse', 'victory', null);
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

    for (let i = 0; i < 4; i++) {
      fireEvent.click(screen.getByTestId('combat-tap-zone'));
    }

    expect(screen.getByTestId('unwired-exit-message')).toHaveTextContent(
      'This path is not written yet',
    );
  });
});
