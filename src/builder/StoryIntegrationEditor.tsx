import { useState } from 'react';
import type {
  Encounter,
  ExitEffect,
  Modifier,
  Moment,
  MomentChoice,
  Move,
} from '../combat/types';
import type { Story } from '../story/types';
import { ConditionEditor, EffectsListEditor } from './ConditionEffectEditors';

export interface StoryIntegrationEditorProps {
  encounter: Encounter;
  story?: Story;
  section?: 'all' | 'storyLinks' | 'outcomes';
  onUpdate: (nextEncounter: Encounter) => void;
}

function formatConditionSummary(cond: Modifier['if']): string {
  if ('flag' in cond) return `flag:${cond.flag}`;
  if ('item' in cond) return `item:${cond.item}`;
  return `stat:${cond.stat} ${cond.op} ${cond.value}`;
}

function slugifyExitKey(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function defaultModifier(): Modifier {
  return {
    if: { flag: 'sabotaged_robot' },
    effect: 'enemyHealth',
    value: -3,
  };
}

function defaultMoment(): Moment {
  return {
    trigger: { enemyHealthAtMost: 3 },
    caption: 'The foe falters.',
    choices: [
      { label: 'Finish it.', then: 'continue' },
      { label: 'Spare it.', then: 'exit', exit: 'victory' },
    ],
  };
}

export function StoryIntegrationEditor({
  encounter,
  story,
  section = 'all',
  onUpdate,
}: StoryIntegrationEditorProps) {
  const showStoryLinks = section === 'all' || section === 'storyLinks';
  const showOutcomes = section === 'all' || section === 'outcomes';
  const [newExitLabel, setNewExitLabel] = useState('');

  const modifiers = encounter.modifiers ?? [];
  const moments = encounter.moments ?? [];
  const exitKeys = Object.keys(encounter.exits).filter(
    (k) => k !== 'retreat' || encounter.allowRetreat,
  );

  const updateModifiers = (next: Modifier[]) => {
    onUpdate({ ...encounter, modifiers: next });
  };

  const updateMoments = (next: Moment[]) => {
    onUpdate({ ...encounter, moments: next });
  };

  const handleAddCustomExit = () => {
    const label = newExitLabel.trim();
    if (!label) return;
    const key = slugifyExitKey(label) || `custom_${Object.keys(encounter.exits).length}`;
    if (encounter.exits[key]) return;
    onUpdate({
      ...encounter,
      exits: {
        ...encounter.exits,
        [key]: { label, effects: [] },
      },
    });
    setNewExitLabel('');
  };

  const handleRemoveCustomExit = (key: string) => {
    const nextExits = { ...encounter.exits };
    delete nextExits[key];
    onUpdate({
      ...encounter,
      exits: nextExits,
    });
  };

  const handleRenameExit = (key: string, label: string) => {
    onUpdate({
      ...encounter,
      exits: {
        ...encounter.exits,
        [key]: { ...encounter.exits[key], label },
      },
    });
  };

  const updateExitEffects = (key: string, effects: ExitEffect[]) => {
    onUpdate({
      ...encounter,
      exits: {
        ...encounter.exits,
        [key]: { ...encounter.exits[key], effects },
      },
    });
  };

  return (
    <div className="story-integration-editor" data-testid="story-integration-editor">
      {showStoryLinks && (
        <>
          <details className="inspector-advanced">
            <summary>Modifiers ({modifiers.length})</summary>
        <div className="inspector-advanced-body">
          {modifiers.map((mod, idx) => {
            return (
              <div
                key={`mod-${idx}`}
                className="integration-card"
                data-testid={`modifier-row-${idx}`}
              >
                <div className="integration-row-head">
                  <strong>
                    #{idx + 1} ({formatConditionSummary(mod.if)})
                  </strong>
                  <button
                    type="button"
                    aria-label={`Remove modifier ${idx + 1}`}
                    onClick={() => updateModifiers(modifiers.filter((_, i) => i !== idx))}
                  >
                    Remove
                  </button>
                </div>

                <ConditionEditor
                  label="Trigger condition"
                  value={mod.if}
                  story={story}
                  allowNone={false}
                  idPrefix={`Modifier ${idx + 1}`}
                  onChange={(nextIf) => {
                    if (!nextIf) return;
                    updateModifiers(
                      modifiers.map((m, i) => (i === idx ? { ...m, if: nextIf } : m)),
                    );
                  }}
                />

                <div className="pattern-editor-row">
                  <select
                    aria-label={`Modifier ${idx + 1} effect`}
                    value={mod.effect}
                    onChange={(e) => {
                      const effect = e.target.value as Modifier['effect'];
                      let nextMod: Modifier;
                      switch (effect) {
                        case 'enemyHealth':
                          nextMod = { if: mod.if, effect, value: -3 };
                          break;
                        case 'enemyHit':
                          nextMod = { if: mod.if, effect, value: -1 };
                          break;
                        case 'revealTells':
                          nextMod = { if: mod.if, effect };
                          break;
                        case 'allyActs':
                          nextMod = {
                            if: mod.if,
                            effect,
                            beat: 3,
                            damage: 2,
                            caption: 'An ally intervenes.',
                          };
                          break;
                        case 'swapPattern':
                          nextMod = { if: mod.if, effect, pattern: ['strike', 'open'] };
                          break;
                        case 'bonusBuffer':
                          nextMod = { if: mod.if, effect, value: 2 };
                          break;
                        case 'unlockChoice':
                          nextMod = { if: mod.if, effect, choiceId: 'parley' };
                          break;
                        case 'unlockExit':
                          nextMod = { if: mod.if, effect, exitKey: 'surrender' };
                          break;
                      }
                      updateModifiers(modifiers.map((m, i) => (i === idx ? nextMod : m)));
                    }}
                  >
                    <option value="enemyHealth">Change enemy health</option>
                    <option value="enemyHit">Change enemy Hit</option>
                    <option value="revealTells">Reveal tells</option>
                    <option value="allyActs">Ally acts</option>
                    <option value="swapPattern">Swap pattern</option>
                    <option value="bonusBuffer">Bonus buffer</option>
                    <option value="unlockChoice">Unlock choice</option>
                    <option value="unlockExit">Unlock exit</option>
                  </select>

                  {(mod.effect === 'enemyHealth' ||
                    mod.effect === 'enemyHit' ||
                    mod.effect === 'bonusBuffer') && (
                    <input
                      type="number"
                      aria-label={`Modifier ${idx + 1} value`}
                      value={mod.value}
                      onChange={(e) =>
                        updateModifiers(
                          modifiers.map((m, i) =>
                            i === idx
                              ? ({ ...m, value: Number(e.target.value) || 0 } as Modifier)
                              : m,
                          ),
                        )
                      }
                    />
                  )}

                  {mod.effect === 'unlockChoice' && (
                    <input
                      type="text"
                      aria-label={`Modifier ${idx + 1} choice id`}
                      value={mod.choiceId}
                      onChange={(e) =>
                        updateModifiers(
                          modifiers.map((m, i) =>
                            i === idx ? { ...m, effect: 'unlockChoice', choiceId: e.target.value } : m,
                          ),
                        )
                      }
                    />
                  )}

                  {mod.effect === 'unlockExit' && (
                    <input
                      type="text"
                      aria-label={`Modifier ${idx + 1} exit key`}
                      value={mod.exitKey}
                      onChange={(e) =>
                        updateModifiers(
                          modifiers.map((m, i) =>
                            i === idx ? { ...m, effect: 'unlockExit', exitKey: e.target.value } : m,
                          ),
                        )
                      }
                    />
                  )}
                </div>

                {mod.effect === 'allyActs' && (
                  <div className="inspector-field">
                    <div className="pattern-editor-row">
                      <input
                        type="number"
                        aria-label={`Modifier ${idx + 1} ally beat`}
                        value={mod.beat}
                        onChange={(e) =>
                          updateModifiers(
                            modifiers.map((m, i) =>
                              i === idx
                                ? { ...mod, beat: Number(e.target.value) || 1 }
                                : m,
                            ),
                          )
                        }
                      />
                      <input
                        type="number"
                        aria-label={`Modifier ${idx + 1} ally damage`}
                        value={mod.damage}
                        onChange={(e) =>
                          updateModifiers(
                            modifiers.map((m, i) =>
                              i === idx
                                ? { ...mod, damage: Number(e.target.value) || 1 }
                                : m,
                            ),
                          )
                        }
                      />
                    </div>
                    <input
                      type="text"
                      aria-label={`Modifier ${idx + 1} ally caption`}
                      value={mod.caption}
                      onChange={(e) =>
                        updateModifiers(
                          modifiers.map((m, i) =>
                            i === idx
                              ? { ...mod, caption: e.target.value }
                              : m,
                          ),
                        )
                      }
                    />
                  </div>
                )}

                {mod.effect === 'swapPattern' && (
                  <input
                    type="text"
                    aria-label={`Modifier ${idx + 1} swap pattern`}
                    value={mod.pattern.join(',')}
                    onChange={(e) => {
                      const parsed = e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(
                          (s): s is Move =>
                            s === 'strike' || s === 'heavy' || s === 'open',
                        );
                      if (parsed.length > 0) {
                        updateModifiers(
                          modifiers.map((m, i) =>
                            i === idx ? { ...m, effect: 'swapPattern', pattern: parsed } : m,
                          ),
                        );
                      }
                    }}
                  />
                )}
              </div>
            );
          })}
          <button type="button" onClick={() => updateModifiers([...modifiers, defaultModifier()])}>
            Add modifier
          </button>
        </div>
      </details>

      <details className="inspector-advanced">
        <summary>Moments ({moments.length})</summary>
        <div className="inspector-advanced-body">
          {moments.map((moment, mIdx) => {
            const trigKind =
              'enemyHealthAtMost' in moment.trigger
                ? 'enemyHealthAtMost'
                : 'playerHealthAtMost' in moment.trigger
                  ? 'playerHealthAtMost'
                  : 'beat' in moment.trigger
                    ? 'beat'
                    : 'phaseStart';
            const trigVal =
              'enemyHealthAtMost' in moment.trigger
                ? moment.trigger.enemyHealthAtMost
                : 'playerHealthAtMost' in moment.trigger
                  ? moment.trigger.playerHealthAtMost
                  : 'beat' in moment.trigger
                    ? moment.trigger.beat
                    : moment.trigger.phaseStart;

            return (
              <div
                key={`moment-${mIdx}`}
                className="integration-card"
                data-testid={`moment-row-${mIdx}`}
              >
                <div className="integration-row-head">
                  <strong>Moment #{mIdx + 1}</strong>
                  <button
                    type="button"
                    aria-label={`Remove moment ${mIdx + 1}`}
                    onClick={() => updateMoments(moments.filter((_, i) => i !== mIdx))}
                  >
                    Remove
                  </button>
                </div>

                <div className="pattern-editor-row">
                  <select
                    aria-label={`Moment ${mIdx + 1} trigger`}
                    value={trigKind}
                    onChange={(e) => {
                      const k = e.target.value;
                      const nextTrigger =
                        k === 'enemyHealthAtMost'
                          ? { enemyHealthAtMost: 3 }
                          : k === 'playerHealthAtMost'
                            ? { playerHealthAtMost: 2 }
                            : k === 'beat'
                              ? { beat: 2 }
                              : { phaseStart: 1 };
                      updateMoments(
                        moments.map((m, i) =>
                          i === mIdx ? { ...m, trigger: nextTrigger } : m,
                        ),
                      );
                    }}
                  >
                    <option value="enemyHealthAtMost">Enemy health at most</option>
                    <option value="playerHealthAtMost">Player health at most</option>
                    <option value="beat">Beat number</option>
                    <option value="phaseStart">Phase start</option>
                  </select>
                  <input
                    type="number"
                    aria-label={`Moment ${mIdx + 1} trigger value`}
                    value={trigVal}
                    onChange={(e) => {
                      const val = Number(e.target.value) || 0;
                      const nextTrigger =
                        trigKind === 'enemyHealthAtMost'
                          ? { enemyHealthAtMost: val }
                          : trigKind === 'playerHealthAtMost'
                            ? { playerHealthAtMost: val }
                            : trigKind === 'beat'
                              ? { beat: val }
                              : { phaseStart: val };
                      updateMoments(
                        moments.map((m, i) =>
                          i === mIdx ? { ...m, trigger: nextTrigger } : m,
                        ),
                      );
                    }}
                  />
                </div>

                <input
                  type="text"
                  aria-label={`Moment ${mIdx + 1} caption`}
                  value={moment.caption}
                  onChange={(e) =>
                    updateMoments(
                      moments.map((m, i) =>
                        i === mIdx ? { ...m, caption: e.target.value } : m,
                      ),
                    )
                  }
                />

                {moment.choices.map((choice, cIdx) => (
                  <div key={`mc-${mIdx}-${cIdx}`} className="pattern-editor-row">
                    <input
                      type="text"
                      aria-label={`Moment ${mIdx + 1} choice ${cIdx + 1} label`}
                      value={choice.label}
                      onChange={(e) => {
                        const nextChoices = moment.choices.map((c, j) =>
                          j === cIdx ? { ...c, label: e.target.value } : c,
                        );
                        updateMoments(
                          moments.map((m, i) =>
                            i === mIdx ? { ...m, choices: nextChoices } : m,
                          ),
                        );
                      }}
                    />
                    <select
                      aria-label={`Moment ${mIdx + 1} choice ${cIdx + 1} action`}
                      value={choice.then}
                      onChange={(e) => {
                        const then = e.target.value as MomentChoice['then'];
                        const nextChoice: MomentChoice =
                          then === 'exit'
                            ? { label: choice.label, then: 'exit', exit: exitKeys[0] ?? 'victory' }
                            : { label: choice.label, then: 'continue' };
                        updateMoments(
                          moments.map((m, i) =>
                            i === mIdx
                              ? {
                                  ...m,
                                  choices: m.choices.map((c, j) =>
                                    j === cIdx ? nextChoice : c,
                                  ),
                                }
                              : m,
                          ),
                        );
                      }}
                    >
                      <option value="continue">Continue</option>
                      <option value="exit">Exit</option>
                    </select>
                    {choice.then === 'exit' && (
                      <select
                        aria-label={`Moment ${mIdx + 1} choice ${cIdx + 1} exit`}
                        value={choice.exit ?? ''}
                        onChange={(e) => {
                          const nextChoices = moment.choices.map((c, j) =>
                            j === cIdx ? { ...c, exit: e.target.value } : c,
                          );
                          updateMoments(
                            moments.map((m, i) =>
                              i === mIdx ? { ...m, choices: nextChoices } : m,
                            ),
                          );
                        }}
                      >
                        {!exitKeys.includes(choice.exit ?? '') && choice.exit && (
                          <option value={choice.exit}>{choice.exit} (missing)</option>
                        )}
                        {exitKeys.map((ek) => (
                          <option key={ek} value={ek}>
                            {encounter.exits[ek]?.label || ek}
                          </option>
                        ))}
                      </select>
                    )}
                    <button
                      type="button"
                      aria-label={`Remove moment ${mIdx + 1} choice ${cIdx + 1}`}
                      disabled={moment.choices.length <= 1}
                      onClick={() => {
                        const nextChoices = moment.choices.filter((_, j) => j !== cIdx);
                        updateMoments(
                          moments.map((m, i) =>
                            i === mIdx ? { ...m, choices: nextChoices } : m,
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
                  disabled={moment.choices.length >= 3}
                  onClick={() => {
                    if (moment.choices.length >= 3) return;
                    const nextChoices: MomentChoice[] = [
                      ...moment.choices,
                      { label: 'New option', then: 'continue' },
                    ];
                    updateMoments(
                      moments.map((m, i) =>
                        i === mIdx ? { ...m, choices: nextChoices } : m,
                      ),
                    );
                  }}
                >
                  Add moment choice
                </button>
              </div>
            );
          })}
          <button type="button" onClick={() => updateMoments([...moments, defaultMoment()])}>
            Add moment
          </button>
        </div>
      </details>
        </>
      )}

      {showOutcomes && (
      <details className="inspector-advanced">
        <summary>Exits &amp; Exit Effects ({exitKeys.length})</summary>
        <div className="inspector-advanced-body">
          <div className="pattern-editor-row">
            <input
              type="text"
              aria-label="New custom exit name"
              placeholder="e.g. Surrender"
              value={newExitLabel}
              onChange={(e) => setNewExitLabel(e.target.value)}
            />
            <button type="button" onClick={handleAddCustomExit}>
              Add custom exit
            </button>
          </div>

          {exitKeys.map((key) => {
            const cfg = encounter.exits[key] ?? { effects: [] };
            const isCustom = key !== 'victory' && key !== 'defeat' && key !== 'retreat';
            return (
              <div key={`exit-${key}`} className="integration-card" data-testid={`exit-cfg-${key}`}>
                <div className="integration-row-head">
                  {isCustom ? (
                    <input
                      type="text"
                      aria-label={`Rename exit ${key}`}
                      value={cfg.label ?? key}
                      onChange={(e) => handleRenameExit(key, e.target.value)}
                    />
                  ) : (
                    <strong>{key.charAt(0).toUpperCase() + key.slice(1)}</strong>
                  )}
                  {isCustom && (
                    <button
                      type="button"
                      aria-label={`Remove exit ${key}`}
                      onClick={() => handleRemoveCustomExit(key)}
                    >
                      Remove exit
                    </button>
                  )}
                </div>

                <EffectsListEditor
                  label="Exit effects"
                  effects={cfg.effects}
                  story={story}
                  idPrefix={key}
                  allowWounds
                  onChange={(nextEffects) => updateExitEffects(key, nextEffects)}
                />
              </div>
            );
          })}
        </div>
      </details>
      )}
    </div>
  );
}
