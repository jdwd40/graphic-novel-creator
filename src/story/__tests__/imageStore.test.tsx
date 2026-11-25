import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import {
  clearImageStoreForTests,
  computeScaledDimensions,
  deleteImage,
  getImage,
  listImages,
  saveImageFile,
  setImageStoreErrorForTests,
} from '../imageStore';
import { createSeedStory } from '../seed';
import { getStoryStorageKey, saveStory } from '../store';
import type { EncounterNode, PassageNode, Story } from '../types';
import { useImageUrl } from '../useImageUrl';
import { StoryMapBuilder } from '../../builder/StoryMapBuilder';
import { EncounterInspector } from '../../builder/EncounterInspector';
import { createDefaultEncounterNode } from '../../builder/graphUtils';

function ImagePreviewProbe({ imageId }: { imageId: string }) {
  const url = useImageUrl(imageId);
  return <img src={url} alt="probe" />;
}

describe('external imageStore (#38)', () => {
  beforeEach(() => {
    localStorage.clear();
    clearImageStoreForTests();
  });

  it('saves and reloads 40 uploaded images with no embedded image data in story localStorage JSON', async () => {
    const story: Story = {
      ...createSeedStory(),
      id: 'forty-images-story',
      coverImage: undefined,
      nodes: {},
      items: {},
    };

    const savedIds: string[] = [];
    for (let i = 0; i < 40; i += 1) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#123456"/><text x="4" y="20">${i}</text></svg>`;
      const file = new File([svg], `panel-${i}.svg`, { type: 'image/svg+xml' });
      const stored = await saveImageFile(file, { storyId: story.id, name: file.name });
      savedIds.push(stored.id);

      const nodeId = `p_${i}`;
      const passage: PassageNode = {
        id: nodeId,
        kind: 'passage',
        title: `Scene ${i}`,
        text: `Scene ${i} text`,
        image: stored.id,
        position: { x: i * 10, y: 0 },
        choices: [],
      };
      story.nodes[nodeId] = passage;
    }
    story.startNodeId = 'p_0';

    saveStory(story);

    const rawJson = localStorage.getItem(getStoryStorageKey(story.id))!;
    expect(rawJson).toBeTruthy();
    expect(rawJson).not.toContain('data:image/');

    const allStored = await listImages(story.id);
    expect(allStored).toHaveLength(40);

    for (let i = 0; i < 40; i += 1) {
      const loaded = await getImage(savedIds[i]);
      expect(loaded).not.toBeNull();
      expect(loaded!.dataUrl).toContain('data:image/svg+xml');
    }

    render(<ImagePreviewProbe imageId={savedIds[17]} />);
    await waitFor(() => {
      const img = screen.getByAltText('probe') as HTMLImageElement;
      expect(img.src).toContain('data:image/svg+xml');
    });
  });

  it('computes scaled dimensions capped at 1600px on the long edge', () => {
    expect(computeScaledDimensions(3200, 1600)).toEqual({
      width: 1600,
      height: 800,
      resized: true,
    });
    expect(computeScaledDimensions(900, 2400)).toEqual({
      width: 600,
      height: 1600,
      resized: true,
    });
    expect(computeScaledDimensions(1200, 800)).toEqual({
      width: 1200,
      height: 800,
      resized: false,
    });
  });

  it('refuses to delete an image still in use and lists all places using it', async () => {
    const file = new File(['<svg xmlns="http://www.w3.org/2000/svg"/>'], 'guard.svg', {
      type: 'image/svg+xml',
    });
    const saved = await saveImageFile(file, { storyId: 'usage-story', name: 'guard.svg' });

    const baseStory = createSeedStory();
    const intro = baseStory.nodes.passage_intro as PassageNode;
    const gatehouse = baseStory.nodes.enc_gatehouse as EncounterNode;
    const story: Story = {
      ...baseStory,
      nodes: {
        ...baseStory.nodes,
        passage_intro: { ...intro, image: saved.id },
        enc_gatehouse: {
          ...gatehouse,
          encounter: {
            ...gatehouse.encounter,
            enemy: { ...gatehouse.encounter.enemy, image: saved.id },
          },
        },
      },
    };

    const refusal = await deleteImage(saved.id, story);
    expect(refusal.ok).toBe(false);
    if (!refusal.ok) {
      const labels = refusal.usedBy.map((u) => u.label);
      expect(labels).toContain('Passage: The Courtyard Gate');
      expect(labels).toContain('Enemy: Gatehouse Guard');
    }
    expect(await getImage(saved.id)).not.toBeNull();

    // Unlink usages, then delete succeeds
    const unlinkedStory: Story = {
      ...story,
      nodes: {
        ...story.nodes,
        passage_intro: { ...intro, image: 'other' },
        enc_gatehouse: {
          ...gatehouse,
          encounter: {
            ...gatehouse.encounter,
            enemy: { ...gatehouse.encounter.enemy, image: 'other' },
          },
        },
      },
    };
    const deleted = await deleteImage(saved.id, unlinkedStory);
    expect(deleted.ok).toBe(true);
    expect(await getImage(saved.id)).toBeNull();
  });

  it('shows a visible error when saving an image or story fails', async () => {
    setImageStoreErrorForTests('Disk quota exceeded while saving image.');

    const node = createDefaultEncounterNode('enc_err');
    function Harness() {
      const [enc, setEnc] = useState(node.encounter);
      return (
        <EncounterInspector
          node={{ ...node, encounter: enc }}
          storyId="err-story"
          onUpdate={setEnc}
        />
      );
    }
    render(<Harness />);

    const input = screen.getByLabelText(/upload enemy image/i) as HTMLInputElement;
    const file = new File(['<svg/>'], 'fail.svg', { type: 'image/svg+xml' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        /Disk quota exceeded while saving image/i,
      );
    });
    setImageStoreErrorForTests(null);

    // Also verify story save failures surface visibly in StoryMapBuilder
    // jsdom treats assignment on a Storage object as storing an item, so the
    // method has to be replaced on the prototype for the failure to reach saveStory.
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage quota full');
    });
    try {
      const seed = createSeedStory();
      render(<StoryMapBuilder story={seed} onStoryChange={() => {}} />);
      fireEvent.click(screen.getByRole('button', { name: /add passage/i }));
      expect(screen.getByTestId('story-save-error')).toHaveTextContent(/Storage quota full/i);
    } finally {
      setItemSpy.mockRestore();
    }
  });
});
