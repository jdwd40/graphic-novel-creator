import { useState } from 'react';
import type { Condition, ExitEffect, StatOperator } from '../combat/types';
import type { ItemDefinition, Story, StoryEffect } from '../story/types';

export function collectStoryFlags(story?: Story): string[] {
  if (!story) return [];
  const flags = new Set<string>();

  const scanEffects = (effects?: readonly StoryEffect[]) => {
    for (const eff of effects ?? []) {
      if ('setFlag' in eff && eff.setFlag.trim()) {
        flags.add(eff.setFlag.trim());
      }
    }
  };
  const scanCond = (cond?: Condition) => {
    if (cond && 'flag' in cond && cond.flag.trim()) {
      flags.add(cond.flag.trim());
    }
  };

  for (const node of Object.values(story.nodes)) {
    if (node.kind === 'passage') {
      scanEffects(node.effects);
      for (const c of node.choices) {
        scanCond(c.condition);
        scanEffects(c.effects);
      }
    } else {
      for (const exit of Object.values(node.encounter.exits)) {
        scanEffects(exit.effects);
      }
      for (const mod of node.encounter.modifiers ?? []) {
        scanCond(mod.if);
      }
      for (const mom of node.encounter.moments ?? []) {
        for (const mc of mom.choices) {
          scanCond(mc.condition);
        }
      }
      if (node.encounter.ruleBreak?.type === 'hiddenTellsUntilFlag') {
        flags.add(node.encounter.ruleBreak.flag);
      }
    }
  }

  return Array.from(flags).sort();
}

export function collectStoryItems(story?: Story): ItemDefinition[] {
  if (!story) return [];
  return Object.values(story.items);
}

export function FlagPickerInput({
  value,
  ariaLabel,
  knownFlags,
  onChange,
}: {
  value: string;
  ariaLabel: string;
  knownFlags: string[];
  onChange: (flag: string) => void;
}) {
  const [customMode, setCustomMode] = useState(
    () => Boolean(value) && !knownFlags.includes(value),
  );
  const options = Array.from(new Set([...knownFlags, ...(value ? [value] : [])])).sort();

  if (customMode || options.length === 0) {
    return (
      <div className="pattern-editor-row" style={{ flex: 1 }}>
        <input
          type="text"
          aria-label={ariaLabel}
          placeholder="flag_name"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        {options.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setCustomMode(false);
              if (!value && options[0]) onChange(options[0]);
            }}
          >
            Pick list
          </button>
        )}
      </div>
    );
  }

  return (
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => {
        if (e.target.value === '__new__') {
          setCustomMode(true);
          onChange('');
        } else {
          onChange(e.target.value);
        }
      }}
    >
      {options.map((f) => (
        <option key={f} value={f}>
          {f}
        </option>
      ))}
      <option value="__new__">+ New flag...</option>
    </select>
  );
}

export function ItemSelectInput({
  value,
  ariaLabel,
  items,
  onChange,
}: {
  value: string;
  ariaLabel: string;
  items: ItemDefinition[];
  onChange: (itemId: string) => void;
}) {
  const hasCurrent = items.some((it) => it.id === value);
  if (items.length === 0) {
    return (
      <input
        type="text"
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  return (
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {!hasCurrent && value && <option value={value}>{value} (missing)</option>}
      {items.map((it) => (
        <option key={it.id} value={it.id}>
          {it.name} ({it.id})
        </option>
      ))}
    </select>
  );
}

export function ConditionEditor({
  label,
  value,
  story,
  allowNone = true,
  idPrefix,
  onChange,
}: {
  label: string;
  value?: Condition;
  story?: Story;
  allowNone?: boolean;
  idPrefix: string;
  onChange: (next: Condition | undefined) => void;
}) {
  const items = collectStoryItems(story);
  const flags = collectStoryFlags(story);
  const condKind = !value
    ? 'none'
    : 'flag' in value
      ? 'flag'
      : 'item' in value
        ? 'item'
        : 'stat';

  const handleKindChange = (nextKind: string) => {
    if (nextKind === 'none') {
      onChange(undefined);
    } else if (nextKind === 'flag') {
      onChange({ flag: flags[0] ?? 'story_flag' });
    } else if (nextKind === 'item') {
      onChange({ item: items[0]?.id ?? 'iron_key' });
    } else {
      onChange({ stat: 'health', op: 'gte', value: 4 });
    }
  };

  return (
    <div className="inspector-field">
      <div className="pattern-editor-row">
        <span className="inspector-sublabel">{label}</span>
        <select
          aria-label={`${idPrefix} condition type`}
          value={condKind}
          onChange={(e) => handleKindChange(e.target.value)}
        >
          {allowNone && <option value="none">Always shown</option>}
          <option value="flag">Flag is set</option>
          <option value="item">Player has item</option>
          <option value="stat">Stat check</option>
        </select>
      </div>

      {value && 'flag' in value && (
        <FlagPickerInput
          value={value.flag}
          ariaLabel={`${idPrefix} flag`}
          knownFlags={flags}
          onChange={(flag) => onChange({ flag })}
        />
      )}

      {value && 'item' in value && (
        <ItemSelectInput
          value={value.item}
          ariaLabel={`${idPrefix} item`}
          items={items}
          onChange={(item) => onChange({ item })}
        />
      )}

      {value && 'stat' in value && (
        <div className="pattern-editor-row">
          <input
            type="text"
            aria-label={`${idPrefix} stat`}
            value={value.stat}
            onChange={(e) => onChange({ ...value, stat: e.target.value })}
          />
          <select
            aria-label={`${idPrefix} stat op`}
            value={value.op}
            onChange={(e) =>
              onChange({ ...value, op: e.target.value as StatOperator })
            }
          >
            <option value="gte">&gt;=</option>
            <option value="gt">&gt;</option>
            <option value="lte">&lt;=</option>
            <option value="lt">&lt;</option>
            <option value="eq">=</option>
            <option value="neq">!=</option>
          </select>
          <input
            type="number"
            aria-label={`${idPrefix} stat value`}
            value={value.value}
            onChange={(e) =>
              onChange({ ...value, value: Number(e.target.value) || 0 })
            }
          />
        </div>
      )}
    </div>
  );
}

export function getEffectKind(effect: ExitEffect): string {
  if ('setFlag' in effect) return 'setFlag';
  if ('addItem' in effect) return 'addItem';
  if ('removeItem' in effect) return 'removeItem';
  if ('changeHealth' in effect) return 'changeHealth';
  if ('addWound' in effect) return 'addWound';
  if ('removeWound' in effect) return 'removeWound';
  return 'rest';
}

export function defaultEffectForKind(kind: string, story?: Story): ExitEffect {
  const firstItem = collectStoryItems(story)[0]?.id ?? 'steel_sword';
  const firstFlag = collectStoryFlags(story)[0] ?? 'new_flag';
  switch (kind) {
    case 'addItem':
      return { addItem: firstItem };
    case 'removeItem':
      return { removeItem: firstItem };
    case 'changeHealth':
      return { changeHealth: 1 };
    case 'addWound':
      return { addWound: 'Cracked rib' };
    case 'removeWound':
      return { removeWound: 'Cracked rib' };
    case 'rest':
      return { rest: true };
    case 'setFlag':
    default:
      return { setFlag: firstFlag };
  }
}

export function EffectsListEditor({
  label,
  effects,
  story,
  idPrefix,
  allowWounds = false,
  onChange,
}: {
  label: string;
  effects: readonly ExitEffect[];
  story?: Story;
  idPrefix: string;
  allowWounds?: boolean;
  onChange: (next: ExitEffect[]) => void;
}) {
  const items = collectStoryItems(story);
  const flags = collectStoryFlags(story);

  return (
    <div className="inspector-field">
      <div className="integration-row-head">
        <span className="inspector-sublabel">
          {label} ({effects.length})
        </span>
        <button
          type="button"
          aria-label={`Add effect to ${idPrefix}`}
          onClick={() => onChange([...effects, defaultEffectForKind('setFlag', story)])}
        >
          Add effect
        </button>
      </div>

      {effects.map((eff, eIdx) => {
        const kind = getEffectKind(eff);
        return (
          <div key={`eff-${idPrefix}-${eIdx}`} className="pattern-editor-row">
            <select
              aria-label={`${idPrefix} effect ${eIdx + 1} type`}
              value={kind}
              onChange={(e) => {
                const nextEff = defaultEffectForKind(e.target.value, story);
                onChange(effects.map((x, j) => (j === eIdx ? nextEff : x)));
              }}
            >
              <option value="setFlag">Set flag</option>
              <option value="addItem">Give item</option>
              <option value="removeItem">Remove item</option>
              <option value="changeHealth">Change health</option>
              <option value="rest">Rest</option>
              {allowWounds && <option value="addWound">Add wound</option>}
              {allowWounds && <option value="removeWound">Remove wound</option>}
            </select>

            {'setFlag' in eff && (
              <FlagPickerInput
                value={eff.setFlag}
                ariaLabel={`${idPrefix} effect ${eIdx + 1} value`}
                knownFlags={flags}
                onChange={(flag) =>
                  onChange(effects.map((x, j) => (j === eIdx ? { setFlag: flag } : x)))
                }
              />
            )}

            {'addItem' in eff && (
              <ItemSelectInput
                value={eff.addItem}
                ariaLabel={`${idPrefix} effect ${eIdx + 1} value`}
                items={items}
                onChange={(item) =>
                  onChange(effects.map((x, j) => (j === eIdx ? { addItem: item } : x)))
                }
              />
            )}

            {'removeItem' in eff && (
              <ItemSelectInput
                value={eff.removeItem}
                ariaLabel={`${idPrefix} effect ${eIdx + 1} value`}
                items={items}
                onChange={(item) =>
                  onChange(effects.map((x, j) => (j === eIdx ? { removeItem: item } : x)))
                }
              />
            )}

            {'changeHealth' in eff && (
              <input
                type="number"
                aria-label={`${idPrefix} effect ${eIdx + 1} value`}
                value={eff.changeHealth}
                onChange={(e) =>
                  onChange(
                    effects.map((x, j) =>
                      j === eIdx ? { changeHealth: Number(e.target.value) || 0 } : x,
                    ),
                  )
                }
              />
            )}

            {'addWound' in eff && (
              <input
                type="text"
                aria-label={`${idPrefix} effect ${eIdx + 1} value`}
                value={eff.addWound}
                onChange={(e) =>
                  onChange(effects.map((x, j) => (j === eIdx ? { addWound: e.target.value } : x)))
                }
              />
            )}

            {'removeWound' in eff && (
              <input
                type="text"
                aria-label={`${idPrefix} effect ${eIdx + 1} value`}
                value={eff.removeWound}
                onChange={(e) =>
                  onChange(
                    effects.map((x, j) => (j === eIdx ? { removeWound: e.target.value } : x)),
                  )
                }
              />
            )}

            <button
              type="button"
              aria-label={`Remove ${idPrefix} effect ${eIdx + 1}`}
              onClick={() => onChange(effects.filter((_, j) => j !== eIdx))}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
