import { useState } from 'react';
import { VALID_MOVES } from '../combat/constants';
import type {
  BossPhase,
  BossRuleBreak,
  Encounter,
  Move,
  WinCondition,
} from '../combat/types';

export interface BossEditorProps {
  encounter: Encounter;
  onUpdate: (nextEncounter: Encounter) => void;
}

export function BossEditor({ encounter, onUpdate }: BossEditorProps) {
  const [ruleBreakWarning, setRuleBreakWarning] = useState<string | null>(null);
  const phases = encounter.phases ?? [];
  const winCondition: WinCondition = encounter.winCondition ?? { type: 'enemyHealthZero' };
  const ruleBreak = encounter.ruleBreak ?? null;

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

  const handleSetRuleBreak = (type: string) => {
    setRuleBreakWarning(null);
    if (type === 'none') {
      onUpdate({ ...encounter, ruleBreak: null });
      return;
    }
    let nextRuleBreak: BossRuleBreak;
    if (type === 'unblockableHeavyWithoutItem') {
      nextRuleBreak = { type: 'unblockableHeavyWithoutItem', item: 'iron_key' };
    } else if (type === 'hiddenTellsUntilFlag') {
      nextRuleBreak = { type: 'hiddenTellsUntilFlag', flag: 'knows_weakness' };
    } else {
      nextRuleBreak = { type: 'healthFloorUntilMoment', floor: 4, momentIndex: 0 };
    }
    onUpdate({ ...encounter, ruleBreak: nextRuleBreak });
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

        <div className="integration-card">
          <div className="inspector-field">
            <label htmlFor="boss-win-condition">Win condition</label>
            <select
              id="boss-win-condition"
              value={winCondition.type}
              onChange={(e) => {
                const t = e.target.value as WinCondition['type'];
                if (t === 'enemyHealthZero') {
                  onUpdate({ ...encounter, winCondition: { type: 'enemyHealthZero' } });
                } else if (t === 'surviveBeats') {
                  onUpdate({ ...encounter, winCondition: { type: 'surviveBeats', beats: 6 } });
                } else {
                  onUpdate({ ...encounter, winCondition: { type: 'reachMoment', momentIndex: 0 } });
                }
              }}
            >
              <option value="enemyHealthZero">Enemy health reaches 0</option>
              <option value="surviveBeats">Survive N beats</option>
              <option value="reachMoment">Reach named moment</option>
            </select>
          </div>

          {winCondition.type === 'surviveBeats' && (
            <div className="inspector-field">
              <label htmlFor="win-survive-beats">Beats to survive</label>
              <input
                id="win-survive-beats"
                type="number"
                min={1}
                value={winCondition.beats}
                onChange={(e) =>
                  onUpdate({
                    ...encounter,
                    winCondition: {
                      type: 'surviveBeats',
                      beats: Math.max(1, Number(e.target.value) || 1),
                    },
                  })
                }
              />
            </div>
          )}

          {winCondition.type === 'reachMoment' && (
            <div className="inspector-field">
              <label htmlFor="win-moment-index">Moment index (0-based)</label>
              <input
                id="win-moment-index"
                type="number"
                min={0}
                value={winCondition.momentIndex}
                onChange={(e) =>
                  onUpdate({
                    ...encounter,
                    winCondition: {
                      type: 'reachMoment',
                      momentIndex: Math.max(0, Number(e.target.value) || 0),
                    },
                  })
                }
              />
            </div>
          )}
        </div>

        <div className="integration-card">
          <div className="inspector-field">
            <label htmlFor="boss-rule-break">Rule-break (at most 1)</label>
            <select
              id="boss-rule-break"
              value={ruleBreak?.type ?? 'none'}
              onChange={(e) => handleSetRuleBreak(e.target.value)}
            >
              <option value="none">None</option>
              <option value="unblockableHeavyWithoutItem">
                Unblockable Heavy without item
              </option>
              <option value="hiddenTellsUntilFlag">Hidden tells until flag</option>
              <option value="healthFloorUntilMoment">Health floor until moment</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => {
              if (ruleBreak) {
                setRuleBreakWarning('Only one rule-break is allowed per encounter.');
              } else {
                handleSetRuleBreak('unblockableHeavyWithoutItem');
              }
            }}
          >
            Add rule-break
          </button>

          {ruleBreakWarning && (
            <p role="alert" style={{ margin: 0, color: '#991b1b', fontSize: '0.8rem' }}>
              {ruleBreakWarning}
            </p>
          )}

          {ruleBreak?.type === 'unblockableHeavyWithoutItem' && (
            <div className="inspector-field">
              <label htmlFor="rb-item">Required counter item</label>
              <input
                id="rb-item"
                type="text"
                value={ruleBreak.item}
                onChange={(e) =>
                  onUpdate({
                    ...encounter,
                    ruleBreak: { ...ruleBreak, item: e.target.value },
                  })
                }
              />
            </div>
          )}

          {ruleBreak?.type === 'hiddenTellsUntilFlag' && (
            <div className="inspector-field">
              <label htmlFor="rb-flag">Flag that reveals tells</label>
              <input
                id="rb-flag"
                type="text"
                value={ruleBreak.flag}
                onChange={(e) =>
                  onUpdate({
                    ...encounter,
                    ruleBreak: { ...ruleBreak, flag: e.target.value },
                  })
                }
              />
            </div>
          )}

          {ruleBreak?.type === 'healthFloorUntilMoment' && (
            <div className="pattern-editor-row">
              <input
                type="number"
                min={1}
                aria-label="Rule-break health floor"
                value={ruleBreak.floor}
                onChange={(e) =>
                  onUpdate({
                    ...encounter,
                    ruleBreak: { ...ruleBreak, floor: Math.max(1, Number(e.target.value) || 1) },
                  })
                }
              />
              <input
                type="number"
                min={0}
                aria-label="Rule-break moment index"
                value={ruleBreak.momentIndex}
                onChange={(e) =>
                  onUpdate({
                    ...encounter,
                    ruleBreak: {
                      ...ruleBreak,
                      momentIndex: Math.max(0, Number(e.target.value) || 0),
                    },
                  })
                }
              />
            </div>
          )}
        </div>
      </div>
    </details>
  );
}
