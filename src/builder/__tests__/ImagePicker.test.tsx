import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearImageStoreForTests, listImages } from '../../story/imageStore';
import { createSeedStory } from '../../story/seed';
import type { EncounterNode, Story } from '../../story/types';
import { EncounterInspector } from '../EncounterInspector';
import { StoryMapBuilder } from '../StoryMapBuilder';

function BuilderHarness() {
  const [story, setStory] = useState<Story>(() => createSeedStory());
  return <StoryMapBuilder story={story} onStoryChange={setStory} />;
}

describe('ImagePicker and ImageLibraryPanel (#39)', () => {
  beforeEach(() => {
    localStorage.clear();
    clearImageStoreForTests();
  });

  it('shows no raw image strings in encounter, art variant, or boss phase editors', () => {
    const story = createSeedStory();
    const bossNode = story.nodes.enc_boss as EncounterNode;

    render(
      <EncounterInspector node={bossNode} story={story} onUpdate={() => {}} />,
    );

    const textInputs = Array.from(document.querySelectorAll('input[type="text"]')) as HTMLInputElement[];
    for (const input of textInputs) {
      expect(input.value).not.toMatch(/^data:image/);
      expect(input.value).not.toMatch(/^img_/);
    }

    expect(screen.getByRole('button', { name: /enemy image: drop image or press enter/i })).toBeInTheDocument();
  });

  it('uploads via drag-and-drop and lets another node reuse the same image without uploading twice', async () => {
    render(<BuilderHarness />);

    // Open Gatehouse Guard
    fireEvent.click(screen.getByTestId('encounter-node-enc_gatehouse'));

    const dropzone = screen.getByRole('button', {
      name: /enemy image: drop image or press enter to upload/i,
    });
    const droppedFile = new File(
      ['<svg xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="8"/></svg>'],
      'shared-banner.svg',
      { type: 'image/svg+xml' },
    );

    const initialSrc = (screen.getByAltText('Enemy image preview') as HTMLImageElement).src;
    fireEvent.drop(dropzone, {
      dataTransfer: { files: [droppedFile] },
    });

    await waitFor(() => {
      const preview = screen.getByAltText('Enemy image preview') as HTMLImageElement;
      expect(preview.src).not.toBe(initialSrc);
    });

    const countBeforeReuse = (await listImages('iron-bell')).length;

    // Select Hammer Brute and reuse uploaded image from library
    fireEvent.click(screen.getByTestId('encounter-node-enc_brute'));
    fireEvent.click(screen.getByRole('button', { name: /choose enemy image from library/i }));

    const pickBtn = await screen.findByRole('button', {
      name: /select image shared-banner\.svg/i,
    });
    fireEvent.click(pickBtn);

    const countAfterReuse = (await listImages('iron-bell')).length;
    expect(countAfterReuse).toBe(countBeforeReuse);
  });

  it('displays story image library usages and refuses deletion while in use', async () => {
    render(<BuilderHarness />);

    fireEvent.click(screen.getByRole('button', { name: /^images$/i }));

    const library = await screen.findByTestId('image-library-panel');
    expect(library).toHaveTextContent(/Used in: Passage: The Courtyard Gate/i);

    fireEvent.click(screen.getByRole('button', { name: /delete The Courtyard Gate\.svg/i }));

    await waitFor(() => {
      expect(screen.getByTestId('image-library-error')).toHaveTextContent(
        /still used in Passage: The Courtyard Gate/i,
      );
    });
  });
});
