import { simulateAcrossTiers, type SimulationResult } from '../combat/simulator';
import type { Encounter } from '../combat/types';

export interface BalancePreviewPanelProps {
  encounter: Encounter;
}

export function formatSimulationResult(result: SimulationResult): string {
  if (result.outcome === 'victory') {
    const beatWord = result.beats === 1 ? 'beat' : 'beats';
    if (result.healthLost === 0) {
      return `Wins in ${result.beats} ${beatWord}, no health lost`;
    }
    return `Wins in ${result.beats} ${beatWord}, loses ${result.healthLost} health`;
  }
  if (result.outcome === 'defeat') {
    return `Defeated on beat ${result.beats}`;
  }
  return `Stalled after ${result.beats} beats`;
}

export function computeBalanceWarnings(encounter: Encounter): string[] {
  const rows = simulateAcrossTiers(encounter);
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
  const rows = simulateAcrossTiers(encounter);
  const warnings = computeBalanceWarnings(encounter);

  return (
    <section aria-label="Balance preview" className="balance-preview-panel">
      <h3>Balance Preview</h3>
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
              <td>{formatSimulationResult(row.autopilot)}</td>
              <td>{formatSimulationResult(row.careful)}</td>
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
