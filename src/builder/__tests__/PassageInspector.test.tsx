import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { StoryPlayer } from '../../player/StoryPlayer';
import { createSeedStory } from '../../story/seed';
import type { PassageNode, Story } from '../../story/types';
import { PassageInspector } from '../PassageInspector';
import { storyToFlowEdges } from '../graphUtils';

function PassageHarness({ initialStory, nodeId }: { initialStory: Story; nodeId: string }) {
  const [story, setStory] = useState<Story>(initialStory);
  const node = story.nodes[nodeId] as PassageNode;

  return (
    <div>
      <PassageInspector
        node={node}
        story={story}
        onUpdate={(nextNode) =>
          setStory((prev) => ({
            ...prev,
            nodes: { ...prev.nodes, [nodeId]: nextNode },
          }))
        }
      />
      <div data-testid="edge-count">{storyToFlowEdges(story).length}</div>
      <StoryPlayer
        key={node.choices.map((c) => `${c.id}:${c.label}`).join('|')}
        story={story}
      />
    </div>
  );
}

describe('PassageInspector choice authoring (#42)', () => {
  it('adds three choices wired to different nodes, reorders them for play mode, and removes orphaned edges cleanly', () => {
    const base = createSeedStory();
    const blankPassage: PassageNode = {
      id: 'passage_hub',
      kind: 'passage',
      title: 'Town Square',
      text: 'Three paths diverge here.',
      position: { x: 0, y: 0 },
      choices: [],
    };
    const story: Story = {
      ...base,
      startNodeId: 'passage_hub',
      nodes: {
        ...base.nodes,
        passage_hub: blankPassage,
      },
    };

    render(<PassageHarness initialStory={story} nodeId="passage_hub" />);

    const initialEdges = Number(screen.getByTestId('edge-count').textContent);

    // Add 3 choices and wire each to a different target node
    fireEvent.click(screen.getByRole('button', { name: /add choice/i }));
    fireEvent.click(screen.getByRole('button', { name: /add choice/i }));
    fireEvent.click(screen.getByRole('button', { name: /add choice/i }));

    fireEvent.change(screen.getByLabelText('Choice 1 label'), {
      target: { value: 'Enter Armory' },
    });
    fireEvent.change(screen.getByLabelText('Choice 1 target'), {
      target: { value: 'passage_armory' },
    });

    fireEvent.change(screen.getByLabelText('Choice 2 label'), {
      target: { value: 'Challenge Guard' },
    });
    fireEvent.change(screen.getByLabelText('Choice 2 target'), {
      target: { value: 'enc_gatehouse' },
    });

    fireEvent.change(screen.getByLabelText('Choice 3 label'), {
      target: { value: 'Pray at Shrine' },
    });
    fireEvent.change(screen.getByLabelText('Choice 3 target'), {
      target: { value: 'passage_shrine' },
    });

    expect(Number(screen.getByTestId('edge-count').textContent)).toBe(initialEdges + 3);

    // Move Choice 3 up twice so order becomes: Pray at Shrine, Enter Armory, Challenge Guard
    fireEvent.click(screen.getByRole('button', { name: 'Move choice 3 up' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move choice 2 up' }));

    const player = screen.getByTestId('story-player');
    const playButtons = Array.from(player.querySelectorAll('.story-choice-btn')).map(
      (b) => b.textContent,
    );
    expect(playButtons).toEqual(['Pray at Shrine', 'Enter Armory', 'Challenge Guard']);

    // Delete choice 2 ('Enter Armory') and verify edge disappears with zero orphan edges
    fireEvent.click(screen.getByRole('button', { name: 'Delete choice 2' }));
    expect(Number(screen.getByTestId('edge-count').textContent)).toBe(initialEdges + 2);

    const updatedPlayer = screen.getByTestId('story-player');
    const remainingButtons = Array.from(updatedPlayer.querySelectorAll('.story-choice-btn')).map(
      (b) => b.textContent,
    );
    expect(remainingButtons).toEqual(['Pray at Shrine', 'Challenge Guard']);
  });
});
