import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { createSeedStory } from '../../story/seed';
import { setExitTarget, updateEncounterNode } from '../../story/store';
import type { EncounterNode, PassageNode, Story } from '../../story/types';
import { validateStory } from '../../story/validation';
import { StoryMapBuilder } from '../StoryMapBuilder';
import { createDefaultEncounterNode, createDefaultPassageNode } from '../graphUtils';

describe('Story & Encounter validation rules (#46)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows 1 error and 2 exit warnings for a new unwired encounter, and clears them when wired', () => {
    const base = createSeedStory();
    const freshEnc = createDefaultEncounterNode('enc_new');
    const intro = base.nodes.passage_intro as PassageNode;
    let story: Story = {
      ...base,
      nodes: {
        ...base.nodes,
        passage_intro: {
          ...intro,
          choices: [...intro.choices, { id: 'c_reach_new', label: 'Go', targetNodeId: 'enc_new' }],
        },
        enc_new: freshEnc,
      },
    };

    const msgs = validateStory(story).filter((m) => m.nodeId === 'enc_new');
    expect(msgs.filter((m) => m.severity === 'error')).toHaveLength(1);
    expect(msgs.filter((m) => m.severity === 'warning')).toHaveLength(2);

    story = setExitTarget(story, 'enc_new', 'victory', 'passage_victory');
    story = setExitTarget(story, 'enc_new', 'defeat', 'passage_defeat_cell');
    story = setExitTarget(story, 'enc_new', 'retreat', 'passage_retreat_alley');
    expect(validateStory(story).filter((m) => m.nodeId === 'enc_new')).toHaveLength(0);
  });

  it('clears the Retreat warning when allowRetreat is turned off', () => {
    const base = createSeedStory();
    const freshEnc = createDefaultEncounterNode('enc_new');
    const intro = base.nodes.passage_intro as PassageNode;
    let story: Story = {
      ...base,
      nodes: {
        ...base.nodes,
        passage_intro: {
          ...intro,
          choices: [...intro.choices, { id: 'c_reach_new', label: 'Go', targetNodeId: 'enc_new' }],
        },
        enc_new: freshEnc,
      },
    };
    story = updateEncounterNode(story, 'enc_new', {
      ...freshEnc.encounter,
      allowRetreat: false,
    });

    const msgs = validateStory(story).filter((m) => m.nodeId === 'enc_new');
    expect(msgs.some((m) => m.message.includes('Retreat'))).toBe(false);
    expect(msgs.filter((m) => m.severity === 'error')).toHaveLength(1);
    expect(msgs.filter((m) => m.severity === 'warning')).toHaveLength(1);
  });

  it('flags missing passage/item/enemy images, dead ends, unreachable nodes, and deleted item refs, and clears each when fixed', () => {
    const base = createSeedStory();
    const deadEndPassage = {
      ...createDefaultPassageNode('passage_dead'),
      title: 'Lost Vault',
      choices: [],
      isEnding: false,
      image: undefined,
    };
    const unreachablePassage = {
      ...createDefaultPassageNode('passage_orphan'),
      title: 'Forgotten Attic',
      image: 'img_seed_armory',
      isEnding: true,
      choices: [],
    };
    const intro = base.nodes.passage_intro as PassageNode;

    const story: Story = {
      ...base,
      items: {
        ...base.items,
        relic: { id: 'relic', name: 'Cracked Relic', description: 'No picture yet' },
      },
      nodes: {
        ...base.nodes,
        passage_intro: {
          ...intro,
          choices: [
            ...intro.choices,
            { id: 'c_to_dead', label: 'Enter Vault', targetNodeId: 'passage_dead' },
            { id: 'c_bad_item', label: 'Use ghost key', targetNodeId: 'passage_shrine', condition: { item: 'deleted_key' } },
          ],
        },
        passage_dead: deadEndPassage,
        passage_orphan: unreachablePassage,
      },
    };

    const msgs = validateStory(story);
    expect(msgs.some((m) => m.id === 'passage_dead:missing-passage-image' && m.severity === 'warning')).toBe(true);
    expect(msgs.some((m) => m.id === 'passage_dead:dead-end' && m.severity === 'warning')).toBe(true);
    expect(msgs.some((m) => m.id === 'item:relic:missing-image' && m.severity === 'warning')).toBe(true);
    expect(msgs.some((m) => m.id === 'passage_orphan:unreachable' && m.severity === 'warning')).toBe(true);
    expect(msgs.some((m) => m.severity === 'error' && m.message.includes('deleted_key'))).toBe(true);

    // Seed story itself should have zero errors and zero warnings!
    expect(validateStory(createSeedStory())).toHaveLength(0);

    // Render builder and click the item warning -> switches to Items tab with Cracked Relic open
    render(<StoryMapBuilder story={story} onStoryChange={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Item "Cracked Relic" has no image/i }));
    expect(screen.getByTestId('item-editor-relic')).toBeInTheDocument();
  });

  it('flags missing name, missing image, empty pattern, and unwired custom exit', () => {
    const base = createSeedStory();
    const encNode = {
      ...(base.nodes.enc_gatehouse as EncounterNode),
      encounter: {
        ...(base.nodes.enc_gatehouse as EncounterNode).encounter,
        enemy: {
          ...(base.nodes.enc_gatehouse as EncounterNode).encounter.enemy,
          name: '',
          image: '',
        },
        pattern: [],
        exits: {
          ...(base.nodes.enc_gatehouse as EncounterNode).encounter.exits,
          bribe: { label: 'Bribe', effects: [] },
        },
      },
    };
    const story = { ...base, nodes: { ...base.nodes, enc_gatehouse: encNode } };
    const msgs = validateStory(story).filter((m) => m.nodeId === 'enc_gatehouse');
    expect(msgs.some((m) => m.message.includes('Enemy name is required'))).toBe(true);
    expect(msgs.some((m) => m.message.includes('Enemy image is required'))).toBe(true);
    expect(msgs.some((m) => m.message.includes('Pattern must contain at least one move'))).toBe(
      true,
    );
    expect(msgs.some((m) => m.message.includes('Custom exit "Bribe" is not wired'))).toBe(true);
  });

  it('focuses and selects the right node when a validation message is clicked', () => {
    const base = createSeedStory();
    const freshEnc = createDefaultEncounterNode('enc_focus');
    const story = {
      ...base,
      nodes: { ...base.nodes, enc_focus: freshEnc },
    };

    render(<StoryMapBuilder story={story} onStoryChange={() => {}} />);

    const errorBtn = screen.getByRole('button', {
      name: /New Enemy: Victory exit is not wired/i,
    });
    fireEvent.click(errorBtn);
    expect(screen.getByTestId('encounter-inspector')).toHaveTextContent('New Enemy');
  });
});
