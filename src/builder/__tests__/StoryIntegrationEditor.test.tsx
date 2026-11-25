import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { createSeedStory } from '../../story/seed';
import { loadStory, saveStory } from '../../story/store';
import type { EncounterNode, Story } from '../../story/types';
import { StoryMapBuilder } from '../StoryMapBuilder';
import { createDefaultEncounterNode } from '../graphUtils';

function BuilderHarness({
  initialStory,
  onLatest,
}: {
  initialStory: Story;
  onLatest?: (story: Story) => void;
}) {
  const [story, setStory] = useState(initialStory);
  return (
    <StoryMapBuilder
      story={story}
      onStoryChange={(next) => {
        setStory(next);
        onLatest?.(next);
      }}
    />
  );
}

describe('StoryIntegrationEditor for modifiers, moments, and custom exits', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('builds modifiers, moments, custom exits, and exit effects and persists across reload', () => {
    const base = createSeedStory();
    let latest: Story = {
      ...base,
      nodes: { ...base.nodes, enc_build: createDefaultEncounterNode('enc_build') },
    };

    render(
      <BuilderHarness
        initialStory={latest}
        onLatest={(next) => {
          latest = next;
        }}
      />,
    );

    fireEvent.click(screen.getByTestId('encounter-node-enc_build'));

    // Add a custom Surrender exit -> Surrender handle appears on node
    fireEvent.click(screen.getByText(/Exits & Exit Effects/i));
    fireEvent.change(screen.getByLabelText(/new custom exit name/i), {
      target: { value: 'Surrender' },
    });
    fireEvent.click(screen.getByRole('button', { name: /add custom exit/i }));
    expect(screen.getByTestId('encounter-node-enc_build')).toHaveTextContent('Surrender');

    // Add an exit effect to surrender
    fireEvent.click(screen.getByRole('button', { name: 'Add effect to surrender' }));
    fireEvent.change(screen.getByLabelText('surrender effect 1 value'), {
      target: { value: 'brute_spared' },
    });

    // Add a modifier and toggle it in balance preview
    fireEvent.click(screen.getByText(/Modifiers \(0\)/i));
    fireEvent.click(screen.getByRole('button', { name: /add modifier/i }));

    // Add a moment pointing to surrender, then remove surrender to trigger validation error
    fireEvent.click(screen.getByText(/Moments \(0\)/i));
    fireEvent.click(screen.getByRole('button', { name: /add moment/i }));
    fireEvent.change(screen.getByLabelText('Moment 1 choice 2 exit'), {
      target: { value: 'surrender' },
    });

    saveStory(latest);
    const reloaded = loadStory(latest.id)!;
    const savedEnc = (reloaded.nodes.enc_build as EncounterNode).encounter;
    expect(savedEnc.exits.surrender.effects).toEqual([{ setFlag: 'brute_spared' }]);
    expect(savedEnc.modifiers).toHaveLength(1);
    expect(savedEnc.moments).toHaveLength(1);

    // Removing Surrender exit while moment still points to it triggers validation error
    fireEvent.click(screen.getByRole('button', { name: 'Remove exit surrender' }));
    expect(
      screen.getByRole('button', { name: /references missing exit "surrender"/i }),
    ).toBeInTheDocument();
  });

  it('updates the balance preview when toggling a modifier condition on and off', () => {
    const story = createSeedStory();
    render(<BuilderHarness initialStory={story} />);

    fireEvent.click(screen.getByTestId('encounter-node-enc_brute'));

    const row1Before = screen.getByRole('row', { name: /Tier 1/i });
    expect(within(row1Before).getByText('Defeated on beat 3')).toBeInTheDocument();

    // Add an enemyHealth -9 modifier and toggle it on in the preview
    fireEvent.click(screen.getByText(/Modifiers \(1\)/i));
    fireEvent.click(screen.getByRole('button', { name: /add modifier/i }));
    fireEvent.change(screen.getByLabelText('Modifier 2 value'), {
      target: { value: '-9' },
    });

    const previewSection = screen.getByLabelText('Preview modifiers');
    const checkboxes = within(previewSection).getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]);

    const row1After = screen.getByRole('row', { name: /Tier 1/i });
    expect(within(row1After).getByText('Wins in 2 beats, no health lost')).toBeInTheDocument();
  });
});
