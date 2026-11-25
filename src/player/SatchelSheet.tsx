import { useEffect, useState } from 'react';
import type { PlayerCombatState } from '../combat/types';
import type { ItemDefinition, Story } from '../story/types';
import { makeFallbackArt } from '../story/artwork';
import { useImageUrl } from '../story/useImageUrl';

export interface SatchelSheetProps {
  story: Story;
  combat: PlayerCombatState;
  carriedItemIds: readonly string[];
  wounds: PlayerCombatState['wounds'];
  onClose: () => void;
}

function describeWeaponStrength(damage?: number): string {
  if (!damage || damage <= 1) return 'Light sidearm';
  if (damage === 2) return 'Balanced weapon';
  if (damage === 3) return 'Sturdy steel weapon';
  return 'Masterwork heavy weapon';
}

function describeArmourStrength(buffer?: number): string {
  if (!buffer || buffer <= 0) return 'Unprotected';
  if (buffer <= 2) return 'Light protection';
  if (buffer <= 4) return 'Sturdy protection';
  return 'Heavy plate protection';
}

function ItemArt({
  imageId,
  name,
  className,
  itemId,
}: {
  imageId?: string;
  name: string;
  className: string;
  itemId: string;
}) {
  const url = useImageUrl(imageId);
  if (url) {
    return <img src={url} alt={name} className={className} />;
  }
  return (
    <div
      className={`${className} satchel-placeholder`}
      data-testid={`satchel-placeholder-${itemId}`}
      aria-hidden="true"
      style={{ backgroundImage: `url("${makeFallbackArt(name, 'item')}")` }}
    />
  );
}

export function SatchelSheet({
  story,
  combat,
  carriedItemIds,
  wounds,
  onClose,
}: SatchelSheetProps) {
  const [selectedId, setSelectedId] = useState<string | null>(
    () => carriedItemIds[0] ?? null,
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const weaponDef = combat.weapon ? story.items[combat.weapon.id] : undefined;
  const armourDef = combat.armour ? story.items[combat.armour.id] : undefined;

  const carriedItems: ItemDefinition[] = carriedItemIds.map(
    (id) =>
      story.items[id] ?? {
        id,
        name: id,
        description: 'Carried item.',
      },
  );
  const selectedItem =
    carriedItems.find((it) => it.id === selectedId) ?? carriedItems[0] ?? null;

  return (
    <div
      className="satchel-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="satchel-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Satchel"
        data-testid="satchel-sheet"
      >
        <span className="sheet-grabber" aria-hidden="true" />
        <div className="satchel-sheet__header">
          <h2>Satchel</h2>
          <button
            type="button"
            className="satchel-sheet__close"
            aria-label="Close satchel sheet"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="satchel-equipped" aria-label="Equipped gear">
          <div className="satchel-equip-card">
            <ItemArt
              imageId={weaponDef?.image}
              name={combat.weapon?.name ?? 'Bare hands'}
              className="satchel-equip-card__img"
              itemId={combat.weapon?.id ?? 'bare_hands'}
            />
            <div>
              <div className="satchel-equip-card__slot">Weapon</div>
              <strong>{combat.weapon?.name ?? 'Bare hands'}</strong>
              <div className="satchel-equip-card__desc">
                {combat.weapon ? describeWeaponStrength(combat.weapon.damage) : 'Light sidearm'}
              </div>
            </div>
          </div>

          <div className="satchel-equip-card">
            <ItemArt
              imageId={armourDef?.image}
              name={combat.armour?.name ?? 'No armour'}
              className="satchel-equip-card__img"
              itemId={combat.armour?.id ?? 'no_armour'}
            />
            <div>
              <div className="satchel-equip-card__slot">Armour</div>
              <strong>{combat.armour?.name ?? 'No armour'}</strong>
              <div className="satchel-equip-card__desc">
                {describeArmourStrength(combat.armour?.buffer)}
              </div>
            </div>
          </div>
        </div>

        <div className="satchel-section">
          <h3>Carried items</h3>
          {carriedItems.length === 0 ? (
            <p className="satchel-empty">Nothing carried yet.</p>
          ) : (
            <div className="satchel-grid" role="list" aria-label="Carried items">
              {carriedItems.map((item) => {
                const isSelected = selectedItem?.id === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="listitem"
                    className={`satchel-tile ${isSelected ? 'is-selected' : ''}`}
                    aria-pressed={isSelected}
                    aria-label={item.name}
                    onClick={() => setSelectedId(item.id)}
                  >
                    <ItemArt
                      imageId={item.image}
                      name={item.name}
                      className="satchel-tile__img"
                      itemId={item.id}
                    />
                    <span className="satchel-tile__name">{item.name}</span>
                  </button>
                );
              })}
            </div>
          )}

          {selectedItem && (
            <div className="satchel-detail" data-testid="satchel-item-detail">
              <ItemArt
                imageId={selectedItem.image}
                name={selectedItem.name}
                className="satchel-detail__img"
                itemId={`${selectedItem.id}-detail`}
              />
              <div>
                <strong>{selectedItem.name}</strong>
                <p>{selectedItem.description || 'Useful along the road.'}</p>
              </div>
            </div>
          )}
        </div>

        <div className="satchel-section">
          <h3>Wounds</h3>
          {wounds.length === 0 ? (
            <p className="satchel-empty">No wounds.</p>
          ) : (
            <ul className="satchel-wounds">
              {wounds.map((w) => (
                <li key={w.name}>
                  {w.name} ({w.description})
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
