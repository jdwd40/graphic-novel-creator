import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { StoryPlayer } from '../../player/StoryPlayer';
import { clearImageStoreForTests } from '../../story/imageStore';
import { createSeedStory } from '../../story/seed';
import type { PassageNode, Story } from '../../story/types';
import { PassageInspector } from '../PassageInspector';
import { StoryMapBuilder } from '../StoryMapBuilder';
import { storyToFlowEdges, storyToFlowNodes } from '../graphUtils';

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

describe('PassageInspector choice authoring (#42, #43)', () => {
  beforeEach(() => {
    localStorage.clear();
    clearImageStoreForTests();
  });
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

  it('sets passage image shown in play mode, marks endings, sets start passage uniquely, and counts words (#43)', async () => {
    function BuilderAndPlayerHarness() {
      const [story, setStory] = useState<Story>(() => createSeedStory());
      return (
        <div>
          <StoryMapBuilder story={story} onStoryChange={setStory} />
          <div data-testid="start-count">
            {storyToFlowNodes(story, null).filter((n) => n.data?.isStart).length}
          </div>
          <StoryPlayer key={story.startNodeId} story={story} />
        </div>
      );
    }

    render(<BuilderAndPlayerHarness />);

    // Select passage_armory and set it as start
    fireEvent.click(screen.getByTestId('passage-node-passage_armory'));
    expect(screen.getByTestId('passage-word-count')).toHaveTextContent(/\d+ words?/);

    fireEvent.change(screen.getByLabelText(/passage text/i), {
      target: { value: 'One two three four five.' },
    });
    expect(screen.getByTestId('passage-word-count')).toHaveTextContent('5 words');

    // Upload a new passage image via ImagePicker
    const file = new File(
      ['<svg xmlns="http://www.w3.org/2000/svg"><text>CustomArmory</text></svg>'],
      'custom-armory.svg',
      { type: 'image/svg+xml' },
    );
    fireEvent.change(screen.getByLabelText(/upload passage image/i), {
      target: { files: [file] },
    });
    await waitFor(() => {
      expect(screen.getByAltText('Passage image preview')).toBeInTheDocument();
    });

    // Mark as start -> exactly one Start badge across map, and player opens at Watch Armory
    fireEvent.click(screen.getByRole('button', { name: /set as start/i }));
    expect(screen.getByTestId('start-count')).toHaveTextContent('1');
    expect(screen.getByTestId('passage-node-passage_armory')).toHaveTextContent('Start');
    expect(screen.getByTestId('passage-node-passage_intro')).not.toHaveTextContent('Start');

    const playImg = screen.getByRole('img', { name: 'Watch Armory' }) as HTMLImageElement;
    expect(playImg.src).toContain('data:image/svg+xml');

    // Toggle ending -> shows Ending badge on map node and ends story in play mode
    fireEvent.click(screen.getByLabelText(/this is an ending/i));
    expect(screen.getByTestId('passage-node-passage_armory')).toHaveTextContent('Ending');
    expect(screen.getByTestId('passage-ending-badge')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /play again/i })).toBeInTheDocument();
  });
});
