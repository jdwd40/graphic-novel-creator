import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSeedStory } from '../../story/seed';
import { setExitTarget } from '../../story/store';
import { StoryPlayer } from '../StoryPlayer';
import { TacticBar } from '../TacticBar';

describe('TacticBar & BattleGuideModal (#55)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows icons, hints, non-colour selected indicator, and separated Retreat button on 360px widths', () => {
    Object.defineProperty(window, 'innerWidth', { value: 360, configurable: true });
    const onSelectTactic = vi.fn();
    const onRetreat = vi.fn();

    render(
      <TacticBar
        currentTactic="guard"
        allowRetreat={true}
        onSelectTactic={onSelectTactic}
        onRetreat={onRetreat}
      />,
    );

    const press = screen.getByRole('button', { name: 'Press' });
    const steady = screen.getByRole('button', { name: 'Steady' });
    const guard = screen.getByRole('button', { name: 'Guard' });
    const retreat = screen.getByRole('button', { name: 'Retreat' });

    expect(press).toHaveTextContent('hit hard, risky');
    expect(steady).toHaveTextContent('even trade');
    expect(guard).toHaveTextContent('block the heavy blow');
    expect(guard).toHaveClass('is-selected');
    expect(guard).toHaveTextContent('✓');
    expect(press.querySelector('svg')).not.toBeNull();
    expect(steady.querySelector('svg')).not.toBeNull();
    expect(guard.querySelector('svg')).not.toBeNull();
    expect(retreat.closest('.combat-retreat-slot')).not.toBeNull();

    fireEvent.click(press);
    expect(onSelectTactic).toHaveBeenCalledWith('press');
    fireEvent.click(retreat);
    expect(onRetreat).toHaveBeenCalledTimes(1);
  });

  it('auto-opens the battle guide once on the first fight, stays hidden on fight two, and reopens from the Reader menu', () => {
    const story = setExitTarget(createSeedStory(), 'enc_gatehouse', 'victory', 'enc_brute');
    render(<StoryPlayer story={story} showTitleScreen={false} />);

    fireEvent.click(screen.getByRole('button', { name: /gear up at the watch armory/i }));
    fireEvent.click(screen.getByRole('button', { name: /step straight into the gatehouse/i }));

    expect(screen.getByTestId('battle-guide-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
    expect(screen.queryByTestId('battle-guide-modal')).not.toBeInTheDocument();

    for (let i = 0; i < 4; i++) {
      fireEvent.click(screen.getByTestId('combat-tap-zone'));
    }
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    // Entering second fight should NOT auto-open the battle guide again.
    expect(screen.getByTestId('combat-screen')).toBeInTheDocument();
    expect(screen.queryByTestId('battle-guide-modal')).not.toBeInTheDocument();

    // Can still reopen on demand from the Reader Menu.
    fireEvent.click(screen.getByRole('button', { name: 'Reader menu' }));
    fireEvent.click(screen.getByRole('button', { name: 'How combat works' }));
    expect(screen.getByTestId('battle-guide-modal')).toBeInTheDocument();
  });
});
