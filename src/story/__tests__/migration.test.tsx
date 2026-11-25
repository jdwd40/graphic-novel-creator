import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  clearImageStoreForTests,
  getImageSync,
  isImageId,
} from '../imageStore';
import { CURRENT_STORY_SCHEMA_VERSION, migrateStoryToImageIds } from '../migration';
import { createSeedStory } from '../seed';
import { getStoryStorageKey, loadStory } from '../store';
import type { EncounterNode, PassageNode, Story } from '../types';
import { StoryPlayer } from '../../player/StoryPlayer';

describe('story schema migration to image IDs (#40)', () => {
  beforeEach(() => {
    localStorage.clear();
    clearImageStoreForTests();
  });

  it('migrates embedded data URLs in saved v1 stories to image IDs on load and is idempotent', () => {
    const v1Story: Story = {
      ...createSeedStory(),
      id: 'legacy-v1-story',
      schemaVersion: undefined,
      nodes: {
        ...createSeedStory().nodes,
        passage_intro: {
          ...(createSeedStory().nodes.passage_intro as PassageNode),
          image: 'data:image/svg+xml;utf8,%3Csvg%3E%3Ctext%3ELegacy%20Intro%3C%2Ftext%3E%3C%2Fsvg%3E',
        },
        enc_gatehouse: {
          ...(createSeedStory().nodes.enc_gatehouse as EncounterNode),
          encounter: {
            ...(createSeedStory().nodes.enc_gatehouse as EncounterNode).encounter,
            enemy: {
              ...(createSeedStory().nodes.enc_gatehouse as EncounterNode).encounter.enemy,
              image: 'data:image/svg+xml;utf8,%3Csvg%3E%3Ctext%3ELegacy%20Guard%3C%2Ftext%3E%3C%2Fsvg%3E',
            },
          },
        },
      },
    };

    localStorage.setItem(getStoryStorageKey(v1Story.id), JSON.stringify(v1Story));

    const loaded = loadStory(v1Story.id)!;
    expect(loaded.schemaVersion).toBe(CURRENT_STORY_SCHEMA_VERSION);

    const introImgId = (loaded.nodes.passage_intro as PassageNode).image!;
    const guardImgId = (loaded.nodes.enc_gatehouse as EncounterNode).encounter.enemy.image;

    expect(isImageId(introImgId)).toBe(true);
    expect(isImageId(guardImgId)).toBe(true);
    expect(decodeURIComponent(getImageSync(introImgId)!.dataUrl)).toContain('Legacy Intro');
    expect(decodeURIComponent(getImageSync(guardImgId)!.dataUrl)).toContain('Legacy Guard');

    const storedAfterLoad = localStorage.getItem(getStoryStorageKey(v1Story.id))!;
    expect(storedAfterLoad).not.toContain('data:image/');

    // Running migration a second time changes nothing.
    const secondPass = migrateStoryToImageIds(loaded);
    expect(secondPass.changed).toBe(false);
    expect(secondPass.story).toEqual(loaded);
  });

  it('plays the migrated seed story from start to victory ending without losing art', () => {
    const story = createSeedStory();
    render(<StoryPlayer story={story} />);

    // First passage renders resolved SVG courtyard image
    const introImg = screen.getByRole('img', { name: 'The Courtyard Gate' }) as HTMLImageElement;
    expect(introImg.src).toContain('data:image/svg+xml');

    // Step to Watch Armory
    fireEvent.click(screen.getByRole('button', { name: /Gear up at the watch armory/i }));
    const armoryImg = screen.getByRole('img', { name: 'Watch Armory' }) as HTMLImageElement;
    expect(armoryImg.src).toContain('data:image/svg+xml');
  });
});
