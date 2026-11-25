import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { createSeedStory } from '../../story/seed';
import { setExitTarget, updateEncounterNode } from '../../story/store';
import type { EncounterNode, Story } from '../../story/types';
import { validateStory } from '../../story/validation';
import { StoryMapBuilder } from '../StoryMapBuilder';
import { createDefaultEncounterNode } from '../graphUtils';

describe('Encounter validation rules', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows 1 error and 2 warnings for a new unwired encounter, and clears them when wired', () => {
    const base = createSeedStory();
    const freshEnc = createDefaultEncounterNode('enc_new');
    let story: Story = {
      ...base,
      nodes: { ...base.nodes, enc_new: freshEnc },
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
    let story: Story = {
      ...base,
      nodes: { ...base.nodes, enc_new: freshEnc },
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
