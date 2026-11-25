import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { StoryPlayer } from '../../player/StoryPlayer';
import { createSeedStory } from '../../story/seed';
import type { PassageNode, Story } from '../../story/types';
import { PassageInspector } from '../PassageInspector';
import { StoryMapBuilder } from '../StoryMapBuilder';

describe('Passage and choice effects & conditions (#44)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('picks items and flags from lists, shows lock/gift markers on the map card, and gates/applies them in play mode', () => {
    function Harness() {
      const [story, setStory] = useState<Story>(() => createSeedStory());
      return (
        <div>
          <StoryMapBuilder story={story} onStoryChange={setStory} />
          <StoryPlayer key={JSON.stringify(story.nodes.passage_intro)} story={story} />
        </div>
      );
    }

    render(<Harness />);

    // Intro already starts selected in StoryMapBuilder
    // Add a second choice gated by iron_key item (picked from dropdown, not typed!)
    fireEvent.click(screen.getByRole('button', { name: /add choice/i }));
    fireEvent.change(screen.getByLabelText('Choice 2 label'), {
      target: { value: 'Secret Belfry Shortcut' },
    });
    fireEvent.change(screen.getByLabelText('Choice 2 target'), {
      target: { value: 'passage_shrine' },
    });
    fireEvent.change(screen.getByLabelText('Choice 2 condition type'), {
      target: { value: 'item' },
    });
    // Item select lists story items
    const itemSelect = screen.getByLabelText('Choice 2 item') as HTMLSelectElement;
    expect(Array.from(itemSelect.options).map((o) => o.value)).toContain('iron_key');
    fireEvent.change(itemSelect, { target: { value: 'iron_key' } });

    // Lock indicator appears on the map card for the gated choice, and choice is hidden in StoryPlayer
    const introCard = screen.getByTestId('passage-node-passage_intro');
    expect(introCard).toHaveTextContent('🔒');
    expect(screen.queryByRole('button', { name: 'Secret Belfry Shortcut' })).not.toBeInTheDocument();

    // First choice on Courtyard Gate gives rusty_sword + padded_coat, so gift indicator appears on card
    expect(screen.getByTestId('choice-gift-c_armory')).toBeInTheDocument();

    // Clicking first choice adds those items to player state in StoryPlayer
    fireEvent.click(screen.getByRole('button', { name: /gear up at the watch armory/i }));
    fireEvent.click(screen.getByRole('button', { name: /gear & wounds/i }));
    expect(screen.getByLabelText(/gear and wounds/i)).toHaveTextContent(/Rusty Sword/i);
    expect(screen.getByLabelText(/gear and wounds/i)).toHaveTextContent(/Padded Coat/i);
  });

  it('allows selecting known flags or adding a new flag on passage effects', () => {
    const story = createSeedStory();
    function InspectorHarness() {
      const [node, setNode] = useState<PassageNode>(story.nodes.passage_intro as PassageNode);
      return <PassageInspector node={node} story={story} onUpdate={setNode} />;
    }

    render(<InspectorHarness />);
    fireEvent.click(screen.getByRole('button', { name: /add effect to passage/i }));

    // Known flag list includes knows_weakness and brute_spared from seed story
    const flagSelect = screen.getByLabelText('Passage effect 1 value') as HTMLSelectElement;
    expect(Array.from(flagSelect.options).map((o) => o.value)).toContain('knows_weakness');

    // Switch to "+ New flag..."
    fireEvent.change(flagSelect, { target: { value: '__new__' } });
    fireEvent.change(screen.getByLabelText('Passage effect 1 value'), {
      target: { value: 'lantern_lit' },
    });
    expect((screen.getByLabelText('Passage effect 1 value') as HTMLInputElement).value).toBe(
      'lantern_lit',
    );
  });
});
