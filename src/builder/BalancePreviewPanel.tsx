import { useState } from 'react';
import { EMPTY_STORY_STATE } from '../combat/conditions';
import { simulateAcrossTiers, type SimulationResult } from '../combat/simulator';
import type { Condition, Encounter, StoryStateSnapshot } from '../combat/types';

export interface BalancePreviewPanelProps {
  encounter: Encounter;
}

function describeCondition(cond: Condition): string {
  if ('flag' in cond) return `Flag: ${cond.flag}`;
  if ('item' in cond) return `Item: ${cond.item}`;
  return `Stat: ${cond.stat} ${cond.op} ${cond.value}`;
}

function buildPreviewStoryState(
  encounter: Encounter,
  enabledIndices: Set<number>,
): StoryStateSnapshot {
  const flags: Record<string, boolean> = {};
  const items: string[] = [];
  const stats: Record<string, number> = {};

  (encounter.modifiers ?? []).forEach((mod, idx) => {
    if (!enabledIndices.has(idx)) return;
    if ('flag' in mod.if) {
      flags[mod.if.flag] = true;
    } else if ('item' in mod.if && !items.includes(mod.if.item)) {
      items.push(mod.if.item);
    } else if ('stat' in mod.if) {
      if (mod.if.op === 'gt') stats[mod.if.stat] = mod.if.value + 1;
      else if (mod.if.op === 'lt') stats[mod.if.stat] = mod.if.value - 1;
      else if (mod.if.op === 'neq') stats[mod.if.stat] = mod.if.value + 1;
      else stats[mod.if.stat] = mod.if.value;
    }
  });

  return { flags, items, stats };
}

export function formatSimulationResult(
  result: SimulationResult,
  showPhases = false,
): string {
  const phaseNote =
    showPhases && result.beatsPerPhase.length > 1
      ? ` (phases: ${result.beatsPerPhase.join(' / ')})`
      : '';
  if (result.outcome === 'victory') {
    const beatWord = result.beats === 1 ? 'beat' : 'beats';
    if (result.healthLost === 0) {
      return `Wins in ${result.beats} ${beatWord}, no health lost${phaseNote}`;
    }
    return `Wins in ${result.beats} ${beatWord}, loses ${result.healthLost} health${phaseNote}`;
  }
  if (result.outcome === 'defeat') {
    return `Defeated on beat ${result.beats}${phaseNote}`;
  }
  return `Stalled after ${result.beats} beats${phaseNote}`;
}

export function computeBalanceWarnings(
  encounter: Encounter,
  storyState: StoryStateSnapshot = EMPTY_STORY_STATE,
): string[] {
  const rows = simulateAcrossTiers(encounter, undefined, { storyState });
  const warnings: string[] = [];

  if (rows.every((r) => r.autopilot.outcome === 'defeat')) {
    warnings.push('Autopilot is defeated at every gear tier.');
  }

  if (rows.some((r) => r.careful.outcome === 'defeat')) {
    warnings.push('Careful play is defeated at one or more gear tiers.');
  }

  const isBoss =
    encounter.enemy.toughness === 'boss' || (encounter.phases?.length ?? 0) > 0;
  if (!isBoss && rows.some((r) => r.autopilot.beats > 6 || r.careful.beats > 6)) {
    warnings.push('Non-boss fight runs longer than 6 beats.');
  }

  return warnings;
}

export function BalancePreviewPanel({ encounter }: BalancePreviewPanelProps) {
  const [enabledModifiers, setEnabledModifiers] = useState<Set<number>>(() => new Set());
  const modifiers = encounter.modifiers ?? [];
  const storyState = buildPreviewStoryState(encounter, enabledModifiers);
  const rows = simulateAcrossTiers(encounter, undefined, { storyState });
  const warnings = computeBalanceWarnings(encounter, storyState);
  const showPhases = (encounter.phases?.length ?? 0) > 0;

  const toggleModifier = (idx: number, checked: boolean) => {
    setEnabledModifiers((prev) => {
      const next = new Set(prev);
      if (checked) next.add(idx);
      else next.delete(idx);
      return next;
    });
  };

  return (
    <section aria-label="Balance preview" className="balance-preview-panel">
      <h3>Balance Preview</h3>

      {modifiers.length > 0 && (
        <div className="preview-modifier-toggles" aria-label="Preview modifiers">
          {modifiers.map((mod, idx) => (
            <label key={`prev-mod-${idx}`} className="inspector-checkbox">
              <input
                type="checkbox"
                checked={enabledModifiers.has(idx)}
                onChange={(e) => toggleModifier(idx, e.target.checked)}
              />
              <span>
                {describeCondition(mod.if)} → {mod.effect}
              </span>
            </label>
          ))}
        </div>
      )}

      <table className="balance-preview-table">
        <caption className="sr-only">
          Simulated fight outcomes across gear tiers for Autopilot and Careful readers
        </caption>
        <thead>
          <tr>
            <th scope="col">Gear tier</th>
            <th scope="col">Autopilot (Steady)</th>
            <th scope="col">Careful</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.tier}>
              <th scope="row">
                Tier {row.tier} ({row.weaponName} / {row.armourName})
              </th>
              <td>{formatSimulationResult(row.autopilot, showPhases)}</td>
              <td>{formatSimulationResult(row.careful, showPhases)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {warnings.length > 0 && (
        <ul className="balance-warnings" aria-label="Balance warnings" role="alert">
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
