import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../App';
import { exportStoryBundle, importStoryBundle } from '../../story/bundle';
import { clearImageStoreForTests, getImage, saveImageFile } from '../../story/imageStore';
import { createPlaythrough, loadPlaythrough, savePlaythrough } from '../../story/playthrough';
import { createSeedStory } from '../../story/seed';
import { deleteStory, getStoryStorageKey, listStories, saveStory } from '../../story/store';
import type { PassageNode } from '../../story/types';

describe('Story Library and bundle export/import (#41)', () => {
  beforeEach(() => {
    localStorage.clear();
    clearImageStoreForTests();
  });

  it('creates a blank story with one start passage, renames, duplicates, and deletes it with images and save', async () => {
    render(<App />);

    // Reset demo story should NOT be in builder toolbar; 'Open demo story' is on home screen
    expect(screen.getByRole('button', { name: /open demo story/i })).toBeInTheDocument();

    // Create a new blank story
    fireEvent.click(screen.getByRole('button', { name: /new story/i }));

    // Opens directly into builder with one start passage
    expect(screen.getByTestId('passage-inspector')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Opening Scene/i })).toBeInTheDocument();

    // Return to Stories home screen
    fireEvent.click(screen.getByRole('button', { name: /^stories$/i }));

    const created = listStories().find((s) => s.id !== 'iron-bell')!;
    expect(created).toBeDefined();
    expect(Object.keys(created.nodes)).toHaveLength(1);
    expect(created.nodes[created.startNodeId]).toBeDefined();

    // Rename it
    const card = screen.getByTestId(`story-card-${created.id}`);
    fireEvent.click(card.querySelector('button:nth-of-type(3)')!); // Rename
    fireEvent.change(screen.getByLabelText(`Rename ${created.title}`), {
      target: { value: 'Clockwork Abbey' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(screen.getByText('Clockwork Abbey')).toBeInTheDocument();

    // Duplicate it
    const renamedCard = screen.getByTestId(`story-card-${created.id}`);
    const dupBtn = Array.from(renamedCard.querySelectorAll('button')).find((b) =>
      /duplicate/i.test(b.textContent ?? ''),
    )!;
    fireEvent.click(dupBtn);
    expect(screen.getByText('Clockwork Abbey (Copy)')).toBeInTheDocument();

    // Attach an uploaded image and playthrough save to Clockwork Abbey before deleting
    const file = new File(['<svg xmlns="http://www.w3.org/2000/svg"/>'], 'abbey.svg', {
      type: 'image/svg+xml',
    });
    const img = await saveImageFile(file, { storyId: created.id, name: 'abbey.svg' });
    const latest = listStories().find((s) => s.id === created.id)!;
    const startPassage = latest.nodes[latest.startNodeId] as PassageNode;
    saveStory({
      ...latest,
      nodes: {
        ...latest.nodes,
        [startPassage.id]: { ...startPassage, image: img.id },
      },
    });
    savePlaythrough(createPlaythrough(latest));

    // Delete with confirmation removes story, its images, and its saved playthrough
    const delBtn = Array.from(screen.getByTestId(`story-card-${created.id}`).querySelectorAll('button')).find(
      (b) => /delete/i.test(b.textContent ?? ''),
    )!;
    fireEvent.click(delBtn);
    fireEvent.click(screen.getByRole('button', { name: /confirm delete/i }));

    await waitFor(async () => {
      expect(localStorage.getItem(getStoryStorageKey(created.id))).toBeNull();
      expect(loadPlaythrough(created.id)).toBeNull();
      expect(await getImage(img.id)).toBeNull();
    });
  });

  it('exports a story bundle with images and imports identically on a clean browser', async () => {
    const story = createSeedStory();
    const file = new File(['<svg xmlns="http://www.w3.org/2000/svg"><text>CustomArt</text></svg>'], 'custom.svg', {
      type: 'image/svg+xml',
    });
    const uploaded = await saveImageFile(file, { storyId: story.id, name: 'custom.svg' });
    const intro = story.nodes.passage_intro as PassageNode;
    const customized = {
      ...story,
      title: 'Exported Iron Bell',
      nodes: {
        ...story.nodes,
        passage_intro: { ...intro, image: uploaded.id },
      },
    };
    saveStory(customized);

    const bundle = await exportStoryBundle(customized);
    const json = JSON.stringify(bundle);
    expect(bundle.images.length).toBeGreaterThan(0);

    // Simulate a fresh browser
    localStorage.clear();
    clearImageStoreForTests();

    const imported = await importStoryBundle(json);
    expect(imported.title).toBe('Exported Iron Bell');
    expect(Object.keys(imported.nodes)).toHaveLength(Object.keys(customized.nodes).length);

    const importedIntro = imported.nodes.passage_intro as PassageNode;
    expect(importedIntro.image).toBeTruthy();
    const resolved = await getImage(importedIntro.image);
    expect(resolved).not.toBeNull();
    const base64Body = resolved!.dataUrl.split(',')[1] ?? '';
    expect(atob(base64Body)).toContain('CustomArt');

    await deleteStory(imported.id);
  });

  it('shows a clear error and changes nothing when importing a broken file', async () => {
    const story = createSeedStory();
    saveStory(story);
    const beforeIds = listStories().map((s) => s.id);

    await expect(importStoryBundle('{not valid json')).rejects.toThrow(/unable to parse json/i);
    expect(listStories().map((s) => s.id)).toEqual(beforeIds);

    render(<App />);
    const input = screen.getByLabelText(/import story bundle file/i) as HTMLInputElement;
    const badFile = new File(['{"format":"wrong"}'], 'broken.json', {
      type: 'application/json',
    });
    // Ensure File.text() exists in jsdom
    Object.defineProperty(badFile, 'text', {
      value: async () => '{"format":"wrong"}',
    });
    fireEvent.change(input, { target: { files: [badFile] } });

    await waitFor(() => {
      expect(screen.getByTestId('library-error')).toHaveTextContent(/unrecognized file format/i);
    });
    expect(listStories().map((s) => s.id)).toEqual(beforeIds);
  });
});
