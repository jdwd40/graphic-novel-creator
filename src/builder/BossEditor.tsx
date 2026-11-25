import { VALID_MOVES } from '../combat/constants';
import type { BossPhase, Encounter, Move } from '../combat/types';

export interface BossEditorProps {
  encounter: Encounter;
  onUpdate: (nextEncounter: Encounter) => void;
}

export function BossEditor({ encounter, onUpdate }: BossEditorProps) {
  const phases = encounter.phases ?? [];

  const updatePhases = (next: BossPhase[]) => {
    onUpdate({
      ...encounter,
      phases: next.slice(0, 2),
    });
  };

  const handleAddPhase = () => {
    if (phases.length >= 2) return;
    const defaultThreshold = Math.max(
      1,
      Math.floor(encounter.enemy.health / (phases.length + 2)),
    );
    updatePhases([
      ...phases,
      {
        healthAtMost: defaultThreshold,
        pattern: ['strike', 'heavy'],
      },
    ]);
  };

  return (
    <details className="inspector-advanced" data-testid="boss-editor">
      <summary>Boss phases &amp; rules ({phases.length + 1} phases)</summary>
      <div className="inspector-advanced-body">
        <p className="inspector-sublabel">
          Phase 1 uses the base pattern &amp; art. Add up to 2 transition phases (max 3 total).
        </p>

        {phases.map((phase, idx) => (
          <div key={`phase-${idx}`} className="integration-card" data-testid={`boss-phase-${idx}`}>
            <div className="integration-row-head">
              <strong>Phase {idx + 2}</strong>
              <button
                type="button"
                aria-label={`Remove phase ${idx + 2}`}
                onClick={() => updatePhases(phases.filter((_, i) => i !== idx))}
              >
                Remove
              </button>
            </div>

            <div className="inspector-field">
              <label htmlFor={`phase-threshold-${idx}`}>Starts at enemy health &lt;=</label>
              <input
                id={`phase-threshold-${idx}`}
                type="number"
                min={1}
                value={phase.healthAtMost}
                onChange={(e) => {
                  const val = Math.max(1, Number(e.target.value) || 1);
                  updatePhases(
                    phases.map((p, i) => (i === idx ? { ...p, healthAtMost: val } : p)),
                  );
                }}
              />
            </div>

            <div className="inspector-field">
              <span className="inspector-label">Phase {idx + 2} pattern</span>
              {phase.pattern.map((move, mIdx) => (
                <div key={`pm-${idx}-${mIdx}`} className="pattern-editor-row">
                  <select
                    aria-label={`Phase ${idx + 2} move ${mIdx + 1}`}
                    value={move}
                    onChange={(e) => {
                      const nextPat = phase.pattern.map((m, j) =>
                        j === mIdx ? (e.target.value as Move) : m,
                      );
                      updatePhases(
                        phases.map((p, i) => (i === idx ? { ...p, pattern: nextPat } : p)),
                      );
                    }}
                  >
                    {VALID_MOVES.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={phase.pattern.length <= 1}
                    aria-label={`Remove phase ${idx + 2} move ${mIdx + 1}`}
                    onClick={() => {
                      if (phase.pattern.length <= 1) return;
                      updatePhases(
                        phases.map((p, i) =>
                          i === idx
                            ? { ...p, pattern: p.pattern.filter((_, j) => j !== mIdx) }
                            : p,
                        ),
                      );
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  updatePhases(
                    phases.map((p, i) =>
                      i === idx ? { ...p, pattern: [...p.pattern, 'strike'] } : p,
                    ),
                  )
                }
              >
                Add phase move
              </button>
            </div>

            <div className="inspector-field">
              <label htmlFor={`phase-image-${idx}`}>Phase {idx + 2} art (optional)</label>
              <input
                id={`phase-image-${idx}`}
                type="text"
                value={phase.image ?? ''}
                onChange={(e) =>
                  updatePhases(
                    phases.map((p, i) =>
                      i === idx
                        ? { ...p, image: e.target.value || undefined }
                        : p,
                    ),
                  )
                }
              />
            </div>
          </div>
        ))}

        <button type="button" disabled={phases.length >= 2} onClick={handleAddPhase}>
          Add phase
        </button>
      </div>
    </details>
  );
}
