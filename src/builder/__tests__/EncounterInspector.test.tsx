import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { validateEncounterJson } from '../../combat/validation';
import type { Encounter } from '../../combat/types';
import { EncounterInspector } from '../EncounterInspector';
import { createDefaultEncounterNode } from '../graphUtils';

function InspectorHarness({ initial = createDefaultEncounterNode('enc_test').encounter }: { initial?: Encounter }) {
  const [encounter, setEncounter] = useState<Encounter>(initial);
  const node = {
    id: 'enc_test',
    kind: 'encounter' as const,
    title: encounter.enemy.name,
    position: { x: 0, y: 0 },
    encounter,
    exitTargets: { victory: null, defeat: null, retreat: null },
  };
  return (
    <div>
      <EncounterInspector node={node} onUpdate={setEncounter} />
      <pre data-testid="stored-json">{JSON.stringify(encounter)}</pre>
    </div>
  );
}

describe('EncounterInspector', () => {
  it('builds a valid encounter from the three required fields and updates live preview', async () => {
    render(<InspectorHarness />);

    fireEvent.change(screen.getByLabelText(/enemy name/i), {
      target: { value: 'Iron Sentinel' },
    });
    const file = new File(['<svg xmlns="http://www.w3.org/2000/svg"/>'], 'sentinel.svg', {
      type: 'image/svg+xml',
    });
    fireEvent.change(screen.getByLabelText(/upload enemy image/i), {
      target: { files: [file] },
    });
    await waitFor(() => {
      const saved = JSON.parse(screen.getByTestId('stored-json').textContent!) as Encounter;
      expect(saved.enemy.image).toMatch(/^img_/);
    });
    fireEvent.change(screen.getByLabelText(/toughness/i), {
      target: { value: 'tough' },
    });
    fireEvent.click(screen.getByRole('tab', { name: 'Fight' }));
    fireEvent.change(screen.getByLabelText(/behaviour/i), {
      target: { value: 'brute' },
    });

    const saved = JSON.parse(screen.getByTestId('stored-json').textContent!) as Encounter;
    expect(validateEncounterJson(saved).valid).toBe(true);
    expect(saved.enemy.health).toBe(12);
    expect(saved.enemy.hit).toBe(2);
    expect(saved.pattern).toEqual(['strike', 'heavy']);

    // Balance preview reflects Tough Brute live without reload.
    const row1 = screen.getByRole('row', { name: /Tier 1/i });
    expect(within(row1).getByText('Defeated on beat 3')).toBeInTheDocument();
    expect(within(row1).getByText('Wins in 6 beats, loses 2 health')).toBeInTheDocument();
  });

  it('switches behaviour to custom and preserves edits when pattern is modified by hand', () => {
    render(<InspectorHarness />);

    fireEvent.click(screen.getByRole('tab', { name: 'Fight' }));
    fireEvent.click(screen.getByText(/advanced encounter settings/i));
    fireEvent.change(screen.getByLabelText(/pattern move 1/i), {
      target: { value: 'heavy' },
    });

    const saved = JSON.parse(screen.getByTestId('stored-json').textContent!) as Encounter;
    expect(saved.behaviour).toBe('custom');
    expect(saved.pattern).toEqual(['heavy', 'strike', 'heavy']);
    expect((screen.getByLabelText(/behaviour/i) as HTMLSelectElement).value).toBe('custom');
  });

  it('stores copied preset values directly on the encounter object', () => {
    render(<InspectorHarness />);
    fireEvent.change(screen.getByLabelText(/toughness/i), { target: { value: 'weak' } });
    fireEvent.click(screen.getByRole('tab', { name: 'Fight' }));
    fireEvent.change(screen.getByLabelText(/behaviour/i), { target: { value: 'skirmisher' } });

    const saved = JSON.parse(screen.getByTestId('stored-json').textContent!) as Encounter;
    expect(saved.enemy.health).toBe(5);
    expect(saved.enemy.hit).toBe(1);
    expect(saved.tellClarity).toBe('clear');
    expect(saved.pattern).toEqual(['strike', 'strike', 'strike', 'open']);
  });

  it('shows Boss tab only for boss toughness and keeps BalancePreviewPanel visible across every tab (#61)', () => {
    render(<InspectorHarness />);

    expect(screen.queryByRole('tab', { name: 'Boss' })).not.toBeInTheDocument();
    expect(screen.getByTestId('pinned-balance-preview')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/toughness/i), { target: { value: 'boss' } });
    expect(screen.getByRole('tab', { name: 'Boss' })).toBeInTheDocument();

    for (const tabName of ['Enemy', 'Fight', 'Story links', 'Outcomes', 'Boss']) {
      fireEvent.click(screen.getByRole('tab', { name: tabName }));
      expect(screen.getByTestId('pinned-balance-preview')).toBeInTheDocument();
    }
    expect(screen.getByTestId('boss-editor')).toBeInTheDocument();
  });
});
