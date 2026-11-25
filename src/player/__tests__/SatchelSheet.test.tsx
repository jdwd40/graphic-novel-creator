import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { applyStoryEffects, createPlaythrough, loadPlaythrough } from '../../story/playthrough';
import { createSeedStory } from '../../story/seed';
import type { Story } from '../../story/types';
import { StoryPlayer } from '../StoryPlayer';

describe('Satchel sheet with item grid and images (#49)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('displays equipped gear with images and plain strength labels, carried grid, placeholder for imageless item, and wounds', () => {
    const base = createSeedStory();
    const story: Story = {
      ...base,
      items: {
        ...base.items,
        mystery_coin: {
          id: 'mystery_coin',
          name: 'Bent Silver Coin',
          description: 'Stamped with an owl on both faces.',
        },
      },
    };
    let pt = createPlaythrough(story);
    pt = applyStoryEffects(pt, story, [
      { addItem: 'rusty_sword' },
      { addItem: 'padded_coat' },
      { addItem: 'mystery_coin' },
      { addWound: 'Cracked rib', description: 'Sharp ache in the chest.' },
    ]);

    render(<StoryPlayer story={story} initialPlaythrough={pt} />);
    fireEvent.click(screen.getByRole('button', { name: /open satchel/i }));

    const dialog = screen.getByRole('dialog', { name: /satchel/i });
    expect(dialog).toBeInTheDocument();
    expect(dialog.textContent ?? '').not.toMatch(/\b(dmg|buf)\b/i);

    const equipped = within(dialog).getByLabelText(/equipped gear/i);
    expect(equipped).toHaveTextContent('Rusty Sword');
    expect(equipped).toHaveTextContent('Balanced weapon');
    expect(equipped).toHaveTextContent('Padded Coat');
    expect(equipped).toHaveTextContent('Light protection');

    // Placeholder renders for Bent Silver Coin (no image)
    expect(screen.getByTestId('satchel-placeholder-mystery_coin')).toBeInTheDocument();

    // Selecting Bent Silver Coin updates detail panel
    fireEvent.click(screen.getByRole('listitem', { name: 'Bent Silver Coin' }));
    expect(screen.getByTestId('satchel-item-detail')).toHaveTextContent(
      'Stamped with an owl on both faces.',
    );
    expect(dialog).toHaveTextContent('Cracked rib (Sharp ache in the chest.)');

    // Escape closes satchel
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: /satchel/i })).not.toBeInTheDocument();
  });

  it('can open and close during a fight without advancing a beat', () => {
    const story = createSeedStory();
    const pt = {
      ...createPlaythrough(story),
      currentNodeId: 'enc_gatehouse',
    };
    render(<StoryPlayer story={story} initialPlaythrough={pt} />);

    expect(loadPlaythrough(story.id)?.activeFight?.fight.beatNumber).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: /open satchel/i }));
    expect(screen.getByRole('dialog', { name: /satchel/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /close satchel sheet/i }));
    expect(screen.queryByRole('dialog', { name: /satchel/i })).not.toBeInTheDocument();
    expect(loadPlaythrough(story.id)?.activeFight?.fight.beatNumber).toBe(0);
  });
});
