import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { createSeedStory } from '../../story/seed';
import { loadStory, saveStory, setExitTarget, updateEncounterNode } from '../../story/store';
import type { EncounterNode } from '../../story/types';
import { StoryMapBuilder } from '../StoryMapBuilder';
import { storyToFlowEdges } from '../graphUtils';

describe('StoryMapBuilder encounter nodes', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('adds a new encounter node with Victory, Defeat, and Retreat handles', () => {
    let story = createSeedStory();
    const { rerender } = render(
      <StoryMapBuilder
        story={story}
        onStoryChange={(next) => {
          story = next;
          rerender(<StoryMapBuilder story={story} onStoryChange={(n) => (story = n)} />);
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /add encounter/i }));

    const newNodeEntry = Object.values(story.nodes).find(
      (n): n is EncounterNode =>
        n.kind === 'encounter' && n.encounter.enemy.name === 'New Enemy',
    );
    expect(newNodeEntry).toBeDefined();

    const nodeCard = screen.getByTestId(`encounter-node-${newNodeEntry!.id}`);
    expect(nodeCard).toHaveTextContent('Victory');
    expect(nodeCard).toHaveTextContent('Defeat');
    expect(nodeCard).toHaveTextContent('Retreat');
  });

  it('persists wired Victory, Defeat, and Retreat exits across reload', () => {
    let story = createSeedStory();
    story = setExitTarget(story, 'enc_gatehouse', 'victory', 'passage_shrine');
    story = setExitTarget(story, 'enc_gatehouse', 'defeat', 'passage_defeat_cell');
    story = setExitTarget(story, 'enc_gatehouse', 'retreat', 'passage_retreat_alley');
    saveStory(story);

    const reloaded = loadStory(story.id)!;
    const enc = reloaded.nodes.enc_gatehouse as EncounterNode;
    expect(enc.exitTargets.victory).toBe('passage_shrine');
    expect(enc.exitTargets.defeat).toBe('passage_defeat_cell');
    expect(enc.exitTargets.retreat).toBe('passage_retreat_alley');
  });

  it('removes only the Retreat handle and edge when allowRetreat is turned off', () => {
    const story = createSeedStory();
    const gatehouse = story.nodes.enc_gatehouse as EncounterNode;
    const updated = updateEncounterNode(story, 'enc_gatehouse', {
      ...gatehouse.encounter,
      allowRetreat: false,
    });

    const edgesBefore = storyToFlowEdges(story);
    const edgesAfter = storyToFlowEdges(updated);
    expect(edgesBefore.some((e) => e.source === 'enc_gatehouse' && e.sourceHandle === 'retreat')).toBe(
      true,
    );
    expect(edgesAfter.some((e) => e.source === 'enc_gatehouse' && e.sourceHandle === 'retreat')).toBe(
      false,
    );
    expect(edgesAfter.some((e) => e.source === 'enc_gatehouse' && e.sourceHandle === 'victory')).toBe(
      true,
    );
    expect(edgesAfter.some((e) => e.source === 'enc_gatehouse' && e.sourceHandle === 'defeat')).toBe(
      true,
    );

    render(<StoryMapBuilder story={updated} onStoryChange={() => {}} />);
    const card = screen.getByTestId('encounter-node-enc_gatehouse');
    expect(card).toHaveTextContent('Victory');
    expect(card).toHaveTextContent('Defeat');
    expect(card).not.toHaveTextContent('Retreat');
  });

  it('supports selecting and deleting an encounter node like a passage node', () => {
    let story = createSeedStory();
    const { rerender } = render(
      <StoryMapBuilder
        story={story}
        onStoryChange={(next) => {
          story = next;
          rerender(<StoryMapBuilder story={story} onStoryChange={(n) => (story = n)} />);
        }}
      />,
    );

    const encCard = screen.getByTestId('encounter-node-enc_gatehouse');
    fireEvent.click(encCard);
    expect(screen.getByRole('heading', { name: /Gatehouse Guard/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /delete selected/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm delete/i }));
    expect(story.nodes.enc_gatehouse).toBeUndefined();
  });
});
