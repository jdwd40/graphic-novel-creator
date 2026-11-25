import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearImageStoreForTests } from '../../story/imageStore';
import { createSeedStory } from '../../story/seed';
import type { Story } from '../../story/types';
import { StoryMapBuilder } from '../StoryMapBuilder';

function BuilderHarness() {
  const [story, setStory] = useState<Story>(() => createSeedStory());
  return <StoryMapBuilder story={story} onStoryChange={setStory} />;
}

describe('Items tab and item images (#45)', () => {
  beforeEach(() => {
    localStorage.clear();
    clearImageStoreForTests();
  });

  it('adds a tier 2 weapon with an image, clamps bounds, and lets a passage give it', async () => {
    render(<BuilderHarness />);

    fireEvent.click(screen.getByRole('button', { name: /^items$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^add item$/i }));

    fireEvent.change(screen.getByLabelText(/item name/i), {
      target: { value: 'Foundry Halberd' },
    });
    fireEvent.change(screen.getByLabelText(/item type/i), {
      target: { value: 'weapon' },
    });
    // Out-of-range value gets clamped to 4 (spec range 1..4)
    fireEvent.change(screen.getByLabelText(/weapon damage/i), {
      target: { value: '99' },
    });
    expect((screen.getByLabelText(/weapon damage/i) as HTMLInputElement).value).toBe('4');

    fireEvent.change(screen.getByLabelText(/weapon damage/i), {
      target: { value: '3' },
    });

    const file = new File(['<svg xmlns="http://www.w3.org/2000/svg"/>'], 'halberd.svg', {
      type: 'image/svg+xml',
    });
    fireEvent.change(screen.getByLabelText(/upload item image/i), {
      target: { files: [file] },
    });
    await waitFor(() => {
      expect(screen.getByAltText('Item image preview')).toBeInTheDocument();
    });

    // Switch back to passage node and give the new item via passage effects
    fireEvent.click(screen.getByTestId('passage-node-passage_intro'));
    fireEvent.click(screen.getByRole('button', { name: /add effect to passage/i }));
    fireEvent.change(screen.getByLabelText('Passage effect 1 type'), {
      target: { value: 'addItem' },
    });
    const itemSelect = screen.getByLabelText('Passage effect 1 value') as HTMLSelectElement;
    const halberdOpt = Array.from(itemSelect.options).find((o) =>
      o.textContent?.includes('Foundry Halberd'),
    )!;
    fireEvent.change(itemSelect, { target: { value: halberdOpt.value } });

    // Back in Items tab, verify usage is listed and deleting is refused with usage list
    fireEvent.click(screen.getByRole('button', { name: /^items$/i }));
    fireEvent.click(screen.getByRole('button', { name: /Foundry Halberd/i }));
    expect(screen.getByTestId('item-usages-list')).toHaveTextContent(
      /Given in Passage "The Courtyard Gate"/i,
    );

    fireEvent.click(screen.getByRole('button', { name: /Delete item Foundry Halberd/i }));
    expect(screen.getByTestId('item-delete-error')).toHaveTextContent(
      /still used in Given in Passage "The Courtyard Gate"/i,
    );
  });

  it('clamps armour buffer to 1..6 and allows deleting unused items', () => {
    render(<BuilderHarness />);

    fireEvent.click(screen.getByRole('button', { name: /^items$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^add item$/i }));
    fireEvent.change(screen.getByLabelText(/item name/i), {
      target: { value: 'Unused Buckler' },
    });
    fireEvent.change(screen.getByLabelText(/item type/i), {
      target: { value: 'armour' },
    });
    fireEvent.change(screen.getByLabelText(/armour buffer/i), {
      target: { value: '12' },
    });
    expect((screen.getByLabelText(/armour buffer/i) as HTMLInputElement).value).toBe('6');

    fireEvent.click(screen.getByRole('button', { name: /Delete item Unused Buckler/i }));
    expect(screen.queryByRole('button', { name: /Unused Buckler/i })).not.toBeInTheDocument();
  });
});
