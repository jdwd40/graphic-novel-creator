import { useMemo, useState } from 'react';
import type { Condition, ExitEffect } from '../combat/types';
import { createPlaythrough, type PlaythroughState } from '../story/playthrough';
import type { ItemDefinition, Story, StoryNode } from '../story/types';

export interface PlayFromHereModalProps {
  story: Story;
  node: StoryNode;
  onStart: (playthrough: PlaythroughState) => void;
  onClose: () => void;
}

function collectFlagsFromCondition(cond: Condition | undefined, out: Set<string>): void {
  if (cond && 'flag' in cond && cond.flag) {
    out.add(cond.flag);
  }
}

function collectFlagsFromEffects(effects: ExitEffect[] | undefined, out: Set<string>): void {
  if (!effects) return;
  for (const eff of effects) {
    if ('setFlag' in eff && eff.setFlag) {
      out.add(eff.setFlag);
    }
  }
}

function collectKnownFlags(story: Story): string[] {
  const out = new Set<string>();
  for (const node of Object.values(story.nodes)) {
    if (node.kind === 'passage') {
      collectFlagsFromEffects(node.effects, out);
      for (const ch of node.choices) {
        collectFlagsFromCondition(ch.condition, out);
        collectFlagsFromEffects(ch.effects, out);
      }
    } else {
      for (const mod of node.encounter.modifiers ?? []) {
        collectFlagsFromCondition(mod.if, out);
      }
      for (const mom of node.encounter.moments ?? []) {
        for (const mc of mom.choices) {
          collectFlagsFromCondition(mc.condition, out);
        }
      }
      for (const exit of Object.values(node.encounter.exits)) {
        collectFlagsFromEffects(exit.effects, out);
      }
    }
  }
  return Array.from(out).sort();
}

/**
 * Setup modal for Play-from-here test runs without overwriting the saved reader playthrough.
 */
export function PlayFromHereModal({
  story,
  node,
  onStart,
  onClose,
}: PlayFromHereModalProps) {
  const allItems = useMemo(() => Object.values(story.items ?? {}), [story.items]);
  const weapons = useMemo(
    () => allItems.filter((item): item is ItemDefinition => typeof item.weaponDamage === 'number'),
    [allItems],
  );
  const armours = useMemo(
    () => allItems.filter((item): item is ItemDefinition => typeof item.armourBuffer === 'number'),
    [allItems],
  );
  const otherItems = useMemo(
    () =>
      allItems.filter(
        (item) => typeof item.weaponDamage !== 'number' && typeof item.armourBuffer !== 'number',
      ),
    [allItems],
  );
  const initialFlags = useMemo(() => collectKnownFlags(story), [story]);

  const [weaponId, setWeaponId] = useState<string>(weapons[0]?.id ?? '');
  const [armourId, setArmourId] = useState<string>(armours[0]?.id ?? '');
  const [health, setHealth] = useState<number>(6);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [checkedFlags, setCheckedFlags] = useState<Record<string, boolean>>({});
  const [customFlag, setCustomFlag] = useState('');
  const [extraFlags, setExtraFlags] = useState<string[]>([]);

  const flagOptions = Array.from(new Set([...initialFlags, ...extraFlags]));

  const handleAddCustomFlag = () => {
    const trimmed = customFlag.trim();
    if (!trimmed) return;
    if (!flagOptions.includes(trimmed)) {
      setExtraFlags((prev) => [...prev, trimmed]);
    }
    setCheckedFlags((prev) => ({ ...prev, [trimmed]: true }));
    setCustomFlag('');
  };

  const handleStart = () => {
    const base = createPlaythrough(story, `test_${story.id}_${node.id}`);
    const selectedWeapon = weapons.find((w) => w.id === weaponId) ?? null;
    const selectedArmour = armours.find((a) => a.id === armourId) ?? null;
    const itemSet = new Set<string>(
      Object.entries(checkedItems)
        .filter(([, on]) => on)
        .map(([id]) => id),
    );
    if (selectedWeapon) itemSet.add(selectedWeapon.id);
    if (selectedArmour) itemSet.add(selectedArmour.id);

    const flags: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(checkedFlags)) {
      if (v) flags[k] = true;
    }

    const pt: PlaythroughState = {
      ...base,
      currentNodeId: node.id,
      seenBattleGuide: true,
      flags,
      items: Array.from(itemSet),
      combat: {
        health: Math.max(1, Math.min(6, health)),
        maxHealth: 6,
        weapon: selectedWeapon
          ? { id: selectedWeapon.id, name: selectedWeapon.name, damage: selectedWeapon.weaponDamage ?? 1 }
          : null,
        armour: selectedArmour
          ? { id: selectedArmour.id, name: selectedArmour.name, buffer: selectedArmour.armourBuffer ?? 1 }
          : null,
        wounds: [],
      },
    };
    onStart(pt);
  };

  return (
    <div
      className="play-here-backdrop"
      data-testid="play-from-here-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="play-here-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Play from ${node.title}`}
      >
        <div className="play-here-modal__header">
          <h3>Play from: {node.title}</h3>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
        </div>

        <p className="inspector-help-text">
          Runs a temporary test playthrough starting on this node without touching your saved reader progress.
        </p>

        <div className="inspector-field">
          <label htmlFor="pfh-weapon">Starting weapon</label>
          <select
            id="pfh-weapon"
            value={weaponId}
            onChange={(e) => setWeaponId(e.target.value)}
          >
            <option value="">Unarmed (1 dmg)</option>
            {weapons.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} (+{w.weaponDamage} dmg)
              </option>
            ))}
          </select>
        </div>

        <div className="inspector-field">
          <label htmlFor="pfh-armour">Starting armour</label>
          <select
            id="pfh-armour"
            value={armourId}
            onChange={(e) => setArmourId(e.target.value)}
          >
            <option value="">None (0 buffer)</option>
            {armours.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} (+{a.armourBuffer} armour)
              </option>
            ))}
          </select>
        </div>

        <div className="inspector-field">
          <label htmlFor="pfh-health">Starting health</label>
          <input
            id="pfh-health"
            type="number"
            min={1}
            max={6}
            value={health}
            onChange={(e) => setHealth(Number(e.target.value) || 6)}
          />
        </div>

        {otherItems.length > 0 && (
          <div className="inspector-field">
            <span className="inspector-label">Satchel items</span>
            <div className="play-here-checks">
              {otherItems.map((item) => (
                <label key={item.id} className="inspector-checkbox">
                  <input
                    type="checkbox"
                    checked={Boolean(checkedItems[item.id])}
                    onChange={(e) =>
                      setCheckedItems((prev) => ({ ...prev, [item.id]: e.target.checked }))
                    }
                  />
                  <span>{item.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="inspector-field">
          <span className="inspector-label">Story flags</span>
          {flagOptions.length > 0 && (
            <div className="play-here-checks">
              {flagOptions.map((flag) => (
                <label key={flag} className="inspector-checkbox">
                  <input
                    type="checkbox"
                    checked={Boolean(checkedFlags[flag])}
                    onChange={(e) =>
                      setCheckedFlags((prev) => ({ ...prev, [flag]: e.target.checked }))
                    }
                  />
                  <span>{flag}</span>
                </label>
              ))}
            </div>
          )}
          <div className="pattern-editor-row">
            <input
              type="text"
              aria-label="Custom test flag"
              placeholder="Add flag name..."
              value={customFlag}
              onChange={(e) => setCustomFlag(e.target.value)}
            />
            <button type="button" onClick={handleAddCustomFlag}>
              Add flag
            </button>
          </div>
        </div>

        <div className="play-here-modal__actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={handleStart}>
            Start test play
          </button>
        </div>
      </div>
    </div>
  );
}
