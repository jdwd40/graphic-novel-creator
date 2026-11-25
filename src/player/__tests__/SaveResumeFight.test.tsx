import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { createPlaythrough, loadPlaythrough } from '../../story/playthrough';
import { createSeedStory } from '../../story/seed';
import type { EncounterNode } from '../../story/types';
import { StoryPlayer } from '../StoryPlayer';

describe('Save and resume a fight in progress', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('reloads mid-fight with health, buffer, beat number, tactic, and tell intact', () => {
    const story = createSeedStory();
    const pt = {
      ...createPlaythrough(story),
      currentNodeId: 'enc_gatehouse',
      combat: {
        ...createPlaythrough(story).combat,
        weapon: { id: 'rusty_sword', name: 'Rusty Sword', damage: 2 },
        armour: { id: 'padded_coat', name: 'Padded Coat', buffer: 2 },
      },
    };
    render(<StoryPlayer story={story} initialPlaythrough={pt} />);

    // Play 1 beat on Press and switch tactic to Guard before reloading
    fireEvent.click(screen.getByRole('button', { name: 'Press' }));
    fireEvent.click(screen.getByTestId('combat-tap-zone'));
    fireEvent.click(screen.getByRole('button', { name: 'Guard' }));

    const tellBeforeReload = screen.getByTestId('combat-tell-caption').textContent;
    const hpBeforeReload = screen.getByRole('img', { name: /Health \d+ of 6/i }).getAttribute(
      'aria-label',
    );

    cleanup();
    // Simulate full page reload reading exclusively from localStorage
    render(<StoryPlayer story={story} />);

    expect(screen.getByTestId('combat-screen')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guard' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('combat-tell-caption').textContent).toBe(tellBeforeReload);
    expect(screen.getByRole('img', { name: /Health \d+ of 6/i }).getAttribute('aria-label')).toBe(
      hpBeforeReload,
    );
    expect(loadPlaythrough(story.id)?.activeFight?.fight.beatNumber).toBe(1);
  });

  it('still plays Open next after reload when pendingOpen was true', () => {
    const base = createSeedStory();
    const bruteNode = base.nodes.enc_brute as EncounterNode;
    const story = {
      ...base,
      nodes: {
        ...base.nodes,
        enc_brute: {
          ...bruteNode,
          encounter: {
            ...bruteNode.encounter,
            tellClarity: 'clear' as const,
            modifiers: [],
          },
        },
      },
    };
    const pt = {
      ...createPlaythrough(story),
      currentNodeId: 'enc_brute',
      combat: {
        ...createPlaythrough(story).combat,
        weapon: { id: 'steel_sword', name: 'Steel Sword', damage: 3 },
        armour: { id: 'mail', name: 'Mail', buffer: 4 },
      },
    };

    render(<StoryPlayer story={story} initialPlaythrough={pt} />);
    // Beat 1: strike -> Beat 2: heavy. Guard heavy to trigger pendingOpen.
    fireEvent.click(screen.getByTestId('combat-tap-zone'));
    fireEvent.click(screen.getByRole('button', { name: 'Guard' }));
    fireEvent.click(screen.getByTestId('combat-tap-zone'));
    expect(loadPlaythrough(story.id)?.activeFight?.fight.pendingOpen).toBe(true);

    cleanup();
    render(<StoryPlayer story={story} />);
    expect(loadPlaythrough(story.id)?.activeFight?.fight.pendingOpen).toBe(true);

    // Switch to Press and resolve the Open beat -> deals 2D = 6 damage!
    fireEvent.click(screen.getByRole('button', { name: 'Press' }));
    fireEvent.click(screen.getByTestId('combat-tap-zone'));
    // Enemy had 12, took 3 on beat 1 (9), 0 on beat 2 (9), 6 on Open (3).
    expect(loadPlaythrough(story.id)?.activeFight?.fight.enemyHealth).toBe(3);
  });

  it('continues with the same shifty pattern after a reload', () => {
    const base = createSeedStory();
    const encNode = base.nodes.enc_gatehouse as EncounterNode;
    const story = {
      ...base,
      nodes: {
        ...base.nodes,
        enc_gatehouse: {
          ...encNode,
          encounter: {
            ...encNode.encounter,
            pattern: ['strike', 'strike'] as Array<'strike' | 'heavy' | 'open'>,
            altPattern: ['heavy', 'open'] as Array<'strike' | 'heavy' | 'open'>,
          },
        },
      },
    };
    const pt = {
      ...createPlaythrough(story, 'pt-shifty-reload'),
      currentNodeId: 'enc_gatehouse',
    };

    render(<StoryPlayer story={story} initialPlaythrough={pt} />);
    fireEvent.click(screen.getByTestId('combat-tap-zone'));
    const activeBefore = loadPlaythrough(story.id)!.activeFight!.fight.activePattern;

    cleanup();
    render(<StoryPlayer story={story} />);
    const activeAfter = loadPlaythrough(story.id)!.activeFight!.fight.activePattern;
    expect(activeAfter).toEqual(activeBefore);
  });

  it('clears the saved activeFight after exiting the fight', () => {
    const story = createSeedStory();
    const pt = {
      ...createPlaythrough(story),
      currentNodeId: 'enc_gatehouse',
      combat: {
        ...createPlaythrough(story).combat,
        weapon: { id: 'rusty_sword', name: 'Rusty Sword', damage: 2 },
        armour: { id: 'padded_coat', name: 'Padded Coat', buffer: 2 },
      },
    };
    render(<StoryPlayer story={story} initialPlaythrough={pt} />);
    expect(loadPlaythrough(story.id)?.activeFight).not.toBeNull();

    for (let i = 0; i < 4; i++) {
      fireEvent.click(screen.getByTestId('combat-tap-zone'));
    }

    expect(loadPlaythrough(story.id)?.activeFight).toBeNull();
  });
});
