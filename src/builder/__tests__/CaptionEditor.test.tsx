import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { BUILTIN_CLEAR_TELL_CAPTIONS, nextTell } from '../../combat/captions';
import { GEAR_TIERS } from '../../combat/constants';
import { startFight } from '../../combat/resolver';
import type { Encounter } from '../../combat/types';
import { CaptionEditor } from '../CaptionEditor';
import { createDefaultEncounterNode } from '../graphUtils';

function CaptionHarness() {
  const [encounter, setEncounter] = useState<Encounter>(
    createDefaultEncounterNode('enc_cap').encounter,
  );
  return (
    <div>
      <CaptionEditor encounter={encounter} onUpdate={setEncounter} />
      <pre data-testid="cap-json">{JSON.stringify(encounter)}</pre>
    </div>
  );
}

describe('CaptionEditor', () => {
  it('saves custom captions onto the encounter, uses them in play, and falls back when empty', () => {
    render(<CaptionHarness />);
    fireEvent.click(screen.getByText(/captions \(tells & results\)/i));

    const strikeInput = screen.getByLabelText('Tell strike caption 1');
    expect(strikeInput).toHaveAttribute('placeholder', BUILTIN_CLEAR_TELL_CAPTIONS.strike[0]);

    fireEvent.change(strikeInput, {
      target: { value: 'The watchman raises his halberd.' },
    });

    const enc = JSON.parse(screen.getByTestId('cap-json').textContent!) as Encounter;
    const state = startFight(enc, {
      health: 6,
      maxHealth: 6,
      weapon: { id: 'w1', name: GEAR_TIERS[0].weaponName, damage: 2 },
      armour: null,
      wounds: [],
    });
    expect(nextTell(state, enc).caption).toBe('The watchman raises his halberd.');

    // Clearing the input falls back to built-in captions.
    fireEvent.change(strikeInput, { target: { value: '' } });
    const cleared = JSON.parse(screen.getByTestId('cap-json').textContent!) as Encounter;
    expect(nextTell(state, cleared).caption).toBe(BUILTIN_CLEAR_TELL_CAPTIONS.strike[0]);
  });

  it('prevents adding a fourth caption to any pool', () => {
    render(<CaptionHarness />);
    fireEvent.click(screen.getByText(/captions \(tells & results\)/i));

    const addBtn = screen.getByRole('button', { name: 'Add strike tell caption' });
    fireEvent.click(addBtn);
    fireEvent.click(addBtn);
    expect(screen.getByLabelText('Tell strike caption 3')).toBeInTheDocument();
    expect(addBtn).toBeDisabled();
    fireEvent.click(addBtn);
    expect(screen.queryByLabelText('Tell strike caption 4')).not.toBeInTheDocument();
  });

  it('resets only the targeted pool without clearing other pools', () => {
    render(<CaptionHarness />);
    fireEvent.click(screen.getByText(/captions \(tells & results\)/i));

    fireEvent.change(screen.getByLabelText('Tell strike caption 1'), {
      target: { value: 'Custom strike tell' },
    });
    fireEvent.change(screen.getByLabelText('Tell heavy caption 1'), {
      target: { value: 'Custom heavy tell' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Reset strike tells' }));

    const enc = JSON.parse(screen.getByTestId('cap-json').textContent!) as Encounter;
    expect(enc.captions?.tell?.strike).toBeUndefined();
    expect(enc.captions?.tell?.heavy).toEqual(['Custom heavy tell']);
  });
});
