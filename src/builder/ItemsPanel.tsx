import { useEffect, useState } from 'react';
import { findItemUsages } from '../story/itemUsage';
import type { ItemDefinition, Story } from '../story/types';
import { useImageUrl } from '../story/useImageUrl';
import { ImagePicker } from './ImagePicker';

export const MIN_WEAPON_DAMAGE = 1;
export const MAX_WEAPON_DAMAGE = 4;
export const MIN_ARMOUR_BUFFER = 1;
export const MAX_ARMOUR_BUFFER = 6;

export function clampWeaponDamage(val: number): number {
  return Math.min(MAX_WEAPON_DAMAGE, Math.max(MIN_WEAPON_DAMAGE, Math.round(val || MIN_WEAPON_DAMAGE)));
}

export function clampArmourBuffer(val: number): number {
  return Math.min(MAX_ARMOUR_BUFFER, Math.max(MIN_ARMOUR_BUFFER, Math.round(val || MIN_ARMOUR_BUFFER)));
}

export type ItemCategory = 'weapon' | 'armour' | 'key';

export function getItemCategory(item: ItemDefinition): ItemCategory {
  if (typeof item.weaponDamage === 'number') return 'weapon';
  if (typeof item.armourBuffer === 'number') return 'armour';
  return 'key';
}

function ItemThumb({ item }: { item: ItemDefinition }) {
  const url = useImageUrl(item.image);
  if (url) {
    return <img src={url} alt={item.name} className="image-library-item__thumb" />;
  }
  return (
    <div className="image-library-item__thumb" style={{ background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', color: '#475569' }}>
      ?
    </div>
  );
}

export interface ItemsPanelProps {
  story: Story;
  initialItemId?: string | null;
  onUpdateStory: (nextStory: Story) => void;
}

export function ItemsPanel({ story, initialItemId, onUpdateStory }: ItemsPanelProps) {
  const items = Object.values(story.items);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(
    () => (initialItemId && story.items[initialItemId] ? initialItemId : items[0]?.id ?? null),
  );
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (initialItemId && story.items[initialItemId]) {
      setSelectedItemId(initialItemId);
      setDeleteError(null);
    }
  }, [initialItemId, story.items]);

  const selectedItem =
    (selectedItemId && story.items[selectedItemId]) || items[0] || null;

  const handleAddItem = () => {
    setDeleteError(null);
    let idx = items.length + 1;
    let id = `item_${idx}`;
    while (story.items[id]) {
      idx += 1;
      id = `item_${idx}`;
    }
    const created: ItemDefinition = {
      id,
      name: `New Item ${idx}`,
      description: '',
    };
    onUpdateStory({
      ...story,
      items: {
        ...story.items,
        [id]: created,
      },
    });
    setSelectedItemId(id);
  };

  const updateSelected = (nextItem: ItemDefinition) => {
    setDeleteError(null);
    onUpdateStory({
      ...story,
      items: {
        ...story.items,
        [nextItem.id]: nextItem,
      },
    });
  };

  const handleCategoryChange = (item: ItemDefinition, category: ItemCategory) => {
    if (category === 'weapon') {
      const next = { ...item, weaponDamage: clampWeaponDamage(item.weaponDamage ?? 2) };
      delete next.armourBuffer;
      updateSelected(next);
    } else if (category === 'armour') {
      const next = { ...item, armourBuffer: clampArmourBuffer(item.armourBuffer ?? 2) };
      delete next.weaponDamage;
      updateSelected(next);
    } else {
      const next = { ...item };
      delete next.weaponDamage;
      delete next.armourBuffer;
      updateSelected(next);
    }
  };

  const handleDeleteItem = (item: ItemDefinition) => {
    const usages = findItemUsages(story, item.id);
    if (usages.length > 0) {
      setDeleteError(
        `Cannot delete "${item.name}": still used in ${usages.map((u) => u.label).join('; ')}.`,
      );
      return;
    }
    const nextItems = { ...story.items };
    delete nextItems[item.id];
    onUpdateStory({
      ...story,
      items: nextItems,
    });
    const remaining = Object.keys(nextItems);
    setSelectedItemId(remaining[0] ?? null);
    setDeleteError(null);
  };

  const selectedUsages = selectedItem ? findItemUsages(story, selectedItem.id) : [];
  const category = selectedItem ? getItemCategory(selectedItem) : 'key';

  return (
    <section className="image-library-panel" aria-label="Story items" data-testid="items-panel">
      <div className="integration-row-head">
        <h3>Items ({items.length})</h3>
        <button type="button" onClick={handleAddItem}>
          Add item
        </button>
      </div>

      {items.length === 0 ? (
        <p className="inspector-sublabel">No items defined yet. Add an item to give or require in passages.</p>
      ) : (
        <ul className="image-library-list" aria-label="Items list">
          {items.map((it) => {
            const cat = getItemCategory(it);
            const active = selectedItem?.id === it.id;
            return (
              <li key={it.id}>
                <button
                  type="button"
                  className={`image-library-item ${active ? 'is-selected' : ''}`}
                  style={{ width: '100%', textAlign: 'left', cursor: 'pointer', borderColor: active ? '#1d4ed8' : undefined }}
                  onClick={() => {
                    setSelectedItemId(it.id);
                    setDeleteError(null);
                  }}
                >
                  <ItemThumb item={it} />
                  <div className="image-library-item__meta">
                    <strong>{it.name}</strong>
                    <span className="inspector-sublabel">
                      {cat === 'weapon'
                        ? `Weapon (${it.weaponDamage})`
                        : cat === 'armour'
                          ? `Armour (${it.armourBuffer})`
                          : 'Key item'}
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {selectedItem && (
        <div className="integration-card" data-testid={`item-editor-${selectedItem.id}`}>
          <div className="integration-row-head">
            <strong>Edit Item</strong>
            <button
              type="button"
              className="btn-danger"
              aria-label={`Delete item ${selectedItem.name}`}
              onClick={() => handleDeleteItem(selectedItem)}
            >
              Delete item
            </button>
          </div>

          {deleteError && (
            <div role="alert" className="image-picker__error" data-testid="item-delete-error">
              {deleteError}
            </div>
          )}

          <div className="inspector-field">
            <label htmlFor="item-name">Item name</label>
            <input
              id="item-name"
              type="text"
              value={selectedItem.name}
              onChange={(e) => updateSelected({ ...selectedItem, name: e.target.value })}
            />
          </div>

          <ImagePicker
            label="Item image"
            value={selectedItem.image}
            story={story}
            onChange={(image) => updateSelected({ ...selectedItem, image })}
            testId="item-image-picker"
          />

          <div className="inspector-field">
            <label htmlFor="item-description">Item description</label>
            <textarea
              id="item-description"
              rows={3}
              value={selectedItem.description}
              onChange={(e) => updateSelected({ ...selectedItem, description: e.target.value })}
            />
          </div>

          <div className="inspector-field">
            <label htmlFor="item-type">Item type</label>
            <select
              id="item-type"
              value={category}
              onChange={(e) =>
                handleCategoryChange(selectedItem, e.target.value as ItemCategory)
              }
            >
              <option value="key">Key item</option>
              <option value="weapon">Weapon (damage 1–4)</option>
              <option value="armour">Armour (buffer 1–6)</option>
            </select>
          </div>

          {category === 'weapon' && (
            <div className="inspector-field">
              <label htmlFor="item-weapon-damage">Weapon damage (1–4)</label>
              <input
                id="item-weapon-damage"
                type="number"
                min={MIN_WEAPON_DAMAGE}
                max={MAX_WEAPON_DAMAGE}
                value={selectedItem.weaponDamage ?? 2}
                onChange={(e) =>
                  updateSelected({
                    ...selectedItem,
                    weaponDamage: clampWeaponDamage(Number(e.target.value)),
                  })
                }
              />
            </div>
          )}

          {category === 'armour' && (
            <div className="inspector-field">
              <label htmlFor="item-armour-buffer">Armour buffer (1–6)</label>
              <input
                id="item-armour-buffer"
                type="number"
                min={MIN_ARMOUR_BUFFER}
                max={MAX_ARMOUR_BUFFER}
                value={selectedItem.armourBuffer ?? 2}
                onChange={(e) =>
                  updateSelected({
                    ...selectedItem,
                    armourBuffer: clampArmourBuffer(Number(e.target.value)),
                  })
                }
              />
            </div>
          )}

          <div className="inspector-field">
            <span className="inspector-sublabel">Where this item is used</span>
            {selectedUsages.length === 0 ? (
              <span className="inspector-sublabel">Not referenced anywhere yet.</span>
            ) : (
              <ul className="pattern-editor-list" data-testid="item-usages-list">
                {selectedUsages.map((u, i) => (
                  <li key={`${u.nodeId}-${i}`} className="inspector-sublabel">
                    {u.label}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
