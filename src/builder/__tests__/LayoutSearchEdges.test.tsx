import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { createSeedStory } from '../../story/seed';
import type { EncounterNode, PassageNode, Story } from '../../story/types';
import { StoryMapBuilder } from '../StoryMapBuilder';
import { storyToFlowEdges } from '../graphUtils';
import { findOverlappingNodePairs, layoutStoryLeftToRight } from '../layoutUtils';

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

describe('Auto-layout, search, and coloured/dashed edges (#64)', () => {
  it('lays the seeded demo story out left-to-right with zero overlapping nodes on Tidy up', () => {
    const seed = createSeedStory();
    // Force overlap first to ensure Tidy up actually fixes overlapping nodes.
    const overlapped: Story = {
      ...seed,
      nodes: Object.fromEntries(
        Object.entries(seed.nodes).map(([id, n]) => [id, { ...n, position: { x: 10, y: 10 } }]),
      ),
    };
    expect(findOverlappingNodePairs(overlapped).length).toBeGreaterThan(0);

    const laidOut = layoutStoryLeftToRight(overlapped);
    expect(findOverlappingNodePairs(laidOut)).toEqual([]);

    let latest = overlapped;
    render(
      <BuilderHarness
        initialStory={latest}
        onLatest={(s) => {
          latest = s;
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Tidy up' }));
    expect(findOverlappingNodePairs(latest)).toEqual([]);
  });

  it('finds and focuses a passage by searching for a word inside its body text', () => {
    const seed = createSeedStory();
    const shrine = seed.nodes.passage_shrine as PassageNode;
    const story: Story = {
      ...seed,
      nodes: {
        ...seed.nodes,
        passage_shrine: {
          ...shrine,
          text: 'Lantern light glints across a silver astrolabe resting beside the altar.',
        },
      },
    };

    render(<BuilderHarness initialStory={story} />);
    const searchInput = screen.getByLabelText('Search story nodes');
    fireEvent.change(searchInput, { target: { value: 'astrolabe' } });

    const listbox = screen.getByRole('listbox', { name: 'Search matches' });
    const option = within(listbox).getByRole('option', { name: new RegExp(shrine.title, 'i') });
    fireEvent.click(option);
    expect(screen.getByTestId('passage-node-passage_shrine')).toHaveClass('is-selected');
  });

  it('assigns distinct colours and non-colour dash patterns across choice, victory, defeat, retreat, and custom edges', () => {
    const seed = createSeedStory();
    const brute = seed.nodes.enc_brute as EncounterNode;
    const story: Story = {
      ...seed,
      nodes: {
        ...seed.nodes,
        enc_brute: {
          ...brute,
          encounter: {
            ...brute.encounter,
            exits: {
              ...brute.encounter.exits,
              surrender: { label: 'Surrender', effects: [] },
            },
          },
          exitTargets: {
            ...brute.exitTargets,
            surrender: 'passage_victory',
          },
        },
      },
    };

    const edges = storyToFlowEdges(story);
    const byKind = new Map<string, { stroke?: string; dash?: string }>();

    for (const edge of edges) {
      const kind = String((edge.data as { edgeKind?: string } | undefined)?.edgeKind ?? '');
      const style = edge.style as { stroke?: string; strokeDasharray?: string } | undefined;
      if (kind) {
        byKind.set(kind, {
          stroke: style?.stroke,
          dash: style?.strokeDasharray ?? 'solid',
        });
      }
    }

    expect(Array.from(byKind.keys()).sort()).toEqual([
      'choice',
      'custom',
      'defeat',
      'retreat',
      'victory',
    ]);

    const colours = new Set(Array.from(byKind.values()).map((v) => v.stroke));
    const dashes = new Set(Array.from(byKind.values()).map((v) => v.dash));
    expect(colours.size).toBe(5);
    expect(dashes.size).toBe(5);
  });
});
