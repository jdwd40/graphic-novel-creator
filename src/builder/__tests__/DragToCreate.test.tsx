import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { createBlankStory } from '../../story/store';
import type { PassageNode, Story } from '../../story/types';
import { StoryMapBuilder } from '../StoryMapBuilder';
import { createAndLinkNodeFromHandle } from '../graphUtils';

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

function createStoryWithChoice(title: string): Story {
  const base = createBlankStory(title);
  const start = base.nodes[base.startNodeId] as PassageNode;
  return {
    ...base,
    nodes: {
      ...base.nodes,
      [start.id]: {
        ...start,
        choices: [{ id: 'c_start', label: 'Step forward', targetNodeId: null }],
      },
    },
  };
}

describe('Drag from choice to create next node (#60)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('builds a three-passage chain via createAndLinkNodeFromHandle', () => {
    let story = createStoryWithChoice('Chain Test');
    const first = story.nodes[story.startNodeId] as PassageNode;
    const step1 = createAndLinkNodeFromHandle(
      story,
      first.id,
      first.choices[0].id,
      'passage',
      { x: 400, y: 120 },
    );
    story = step1.story;
    const second = story.nodes[step1.createdNodeId] as PassageNode;
    const step2 = createAndLinkNodeFromHandle(
      story,
      second.id,
      second.choices[0].id,
      'passage',
      { x: 750, y: 120 },
    );
    story = step2.story;

    expect((story.nodes[first.id] as PassageNode).choices[0].targetNodeId).toBe(step1.createdNodeId);
    expect((story.nodes[step1.createdNodeId] as PassageNode).choices[0].targetNodeId).toBe(
      step2.createdNodeId,
    );
    expect(Object.keys(story.nodes)).toHaveLength(3);
  });

  it('opens a creation menu on empty-canvas connection drop, creates nothing on Cancel/Escape, and links on choice', () => {
    let latest = createStoryWithChoice('Drag Drop Test');
    const startId = latest.startNodeId;
    const startChoice = (latest.nodes[startId] as PassageNode).choices[0];

    render(
      <BuilderHarness
        initialStory={latest}
        onLatest={(s) => {
          latest = s;
        }}
      />,
    );

    const handle = screen.getByLabelText(`Choice ${startChoice.label}`);

    // Drag and release on empty pane -> menu appears; Escape cancels cleanly
    fireEvent.mouseDown(handle, { button: 0, clientX: 50, clientY: 50 });
    fireEvent.mouseMove(document, { clientX: 250, clientY: 160 });
    fireEvent.mouseUp(document, { clientX: 250, clientY: 160 });

    const menu = screen.getByTestId('drag-create-menu');
    expect(menu).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('drag-create-menu')).not.toBeInTheDocument();
    expect(Object.keys(latest.nodes)).toHaveLength(1);

    // Drag again -> pick New passage -> node created, linked, and selected
    fireEvent.mouseDown(handle, { button: 0, clientX: 50, clientY: 50 });
    fireEvent.mouseMove(document, { clientX: 260, clientY: 180 });
    fireEvent.mouseUp(document, { clientX: 260, clientY: 180 });
    fireEvent.click(screen.getByRole('menuitem', { name: 'New passage' }));

    expect(Object.keys(latest.nodes)).toHaveLength(2);
    const secondId = (latest.nodes[startId] as PassageNode).choices[0].targetNodeId!;
    expect(secondId).toBeTruthy();
    expect(screen.getByTestId(`passage-node-${secondId}`)).toHaveClass('is-selected');

    // Drag from new node's choice -> pick New encounter -> encounter created, linked, and selected
    const secondChoice = (latest.nodes[secondId] as PassageNode).choices[0];
    const secondHandle = screen.getByLabelText(`Choice ${secondChoice.label}`);
    fireEvent.mouseDown(secondHandle, { button: 0, clientX: 60, clientY: 60 });
    fireEvent.mouseMove(document, { clientX: 300, clientY: 220 });
    fireEvent.mouseUp(document, { clientX: 300, clientY: 220 });
    fireEvent.click(screen.getByRole('menuitem', { name: 'New encounter' }));

    expect(Object.keys(latest.nodes)).toHaveLength(3);
    const thirdId = (latest.nodes[secondId] as PassageNode).choices[0].targetNodeId!;
    expect(latest.nodes[thirdId].kind).toBe('encounter');
    expect(screen.getByTestId(`encounter-node-${thirdId}`)).toHaveClass('is-selected');
  });
});
