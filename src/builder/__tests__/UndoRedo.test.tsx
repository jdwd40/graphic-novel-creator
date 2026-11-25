import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { createSeedStory } from '../../story/seed';
import { createBlankStory, loadStory } from '../../story/store';
import type { Story } from '../../story/types';
import { StoryMapBuilder } from '../StoryMapBuilder';
import { useStoryHistory } from '../useStoryHistory';

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

describe('Builder undo and redo history (#63)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('asks confirmation before deleting a connected node and restores both node and edges on Undo', () => {
    let latest = createSeedStory();
    render(
      <BuilderHarness
        initialStory={latest}
        onLatest={(s) => {
          latest = s;
        }}
      />,
    );

    fireEvent.click(screen.getByTestId('encounter-node-enc_gatehouse'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete selected' }));

    // Cancel leaves connected node untouched
    expect(screen.getByTestId('confirm-delete-node-dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(latest.nodes.enc_gatehouse).toBeDefined();

    // Confirm delete removes node and unlinks incoming/outgoing references
    fireEvent.click(screen.getByRole('button', { name: 'Delete selected' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));
    expect(latest.nodes.enc_gatehouse).toBeUndefined();
    const armory = latest.nodes.passage_armory;
    expect(armory.kind === 'passage' && armory.choices[0].targetNodeId).toBeNull();

    // Undo restores node + incoming + outgoing links and saves cleanly
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(latest.nodes.enc_gatehouse).toBeDefined();
    const restoredArmory = latest.nodes.passage_armory;
    expect(restoredArmory.kind === 'passage' && restoredArmory.choices[0].targetNodeId).toBe(
      'enc_gatehouse',
    );
    const saved = loadStory(latest.id);
    expect(saved?.nodes.enc_gatehouse).toBeDefined();

    // Ctrl+Shift+Z redoes deletion, Ctrl+Z undoes again
    (document.activeElement as HTMLElement | null)?.blur?.();
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true, shiftKey: true });
    expect(latest.nodes.enc_gatehouse).toBeUndefined();
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(latest.nodes.enc_gatehouse).toBeDefined();
  });

  it('retains at least 20 undo steps and coalesces rapid typing edits in StoryMapBuilder', () => {
    const story0 = createBlankStory('History Test');
    const { result } = renderHook(() => useStoryHistory(story0.id));

    let current = story0;
    act(() => {
      for (let i = 1; i <= 25; i++) {
        result.current.pushChange(current);
        current = { ...current, title: `Edit ${i}` };
      }
    });
    expect(result.current.pastCount).toBe(25);

    act(() => {
      for (let i = 0; i < 25; i++) {
        const prev = result.current.undo(current);
        expect(prev).not.toBeNull();
        current = prev!;
      }
    });
    expect(current.title).toBe('History Test');

    // Also verify rapid typing coalescing inside StoryMapBuilder UI
    let latest = createBlankStory('Coalesce UI');
    render(
      <BuilderHarness
        initialStory={latest}
        onLatest={(s) => {
          latest = s;
        }}
      />,
    );

    const titleInput = screen.getByLabelText('Passage title');
    fireEvent.change(titleInput, { target: { value: 'A' } });
    fireEvent.change(titleInput, { target: { value: 'AB' } });
    fireEvent.change(titleInput, { target: { value: 'ABC' } });
    expect(latest.nodes[latest.startNodeId].title).toBe('ABC');

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(latest.nodes[latest.startNodeId].title).toBe('Opening Scene');
  });
});
