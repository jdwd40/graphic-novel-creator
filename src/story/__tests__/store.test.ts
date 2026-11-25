import { beforeEach, describe, expect, it } from 'vitest';
import { validateEncounterJson } from '../../combat/validation';
import { createSeedStory } from '../seed';
import { deleteNode, loadStory, saveStory, updateEncounterNode } from '../store';
import type { EncounterNode } from '../types';

describe('story data model and encounter persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saves and reloads an encounter with every field intact', () => {
    const story = createSeedStory();
    saveStory(story);
    const loaded = loadStory(story.id);
    expect(loaded).not.toBeNull();
    expect(loaded!.nodes.enc_brute).toEqual(story.nodes.enc_brute);
  });

  it('refuses invalid encounter JSON with the validator message', () => {
    const story = createSeedStory();
    const encNode = story.nodes.enc_gatehouse as EncounterNode;
    const invalid = {
      ...encNode.encounter,
      pattern: [],
    };
    expect(() => updateEncounterNode(story, 'enc_gatehouse', invalid)).toThrow(/pattern/i);
  });

  it('leaves the encounter in place with that exit unwired when a target passage is deleted', () => {
    const story = createSeedStory();
    const afterDelete = deleteNode(story, 'passage_shrine');
    const enc = afterDelete.nodes.enc_gatehouse as EncounterNode;
    expect(enc).toBeDefined();
    expect(enc.exitTargets.victory).toBeNull();
    expect(enc.exitTargets.defeat).toBe('passage_defeat_cell');
  });

  it('seeds a valid story with encounters reached after tier 1 gear', () => {
    const story = createSeedStory();
    const intro = story.nodes[story.startNodeId];
    expect(intro.kind).toBe('passage');
    if (intro.kind === 'passage') {
      const armoryChoice = intro.choices[0];
      expect(armoryChoice.targetNodeId).toBe('passage_armory');
      expect(armoryChoice.effects).toContainEqual({ addItem: 'rusty_sword' });
      expect(armoryChoice.effects).toContainEqual({ addItem: 'padded_coat' });
    }

    const encNode = story.nodes.enc_gatehouse as EncounterNode;
    expect(validateEncounterJson(encNode.encounter).valid).toBe(true);
  });
});
