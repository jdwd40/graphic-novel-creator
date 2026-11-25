import type { ChangeEvent } from 'react';
import type { Encounter, EncounterArt } from '../combat/types';

export interface ArtVariantsEditorProps {
  encounter: Encounter;
  onUpdate: (nextEncounter: Encounter) => void;
}

const VARIANT_FIELDS: ReadonlyArray<{
  key: keyof Omit<EncounterArt, 'phases'>;
  label: string;
}> = [
  { key: 'open', label: 'Enemy Open art' },
  { key: 'enemyWounded', label: 'Enemy wounded art' },
  { key: 'playerWounded', label: 'Player wounded art' },
];

export function ArtVariantsEditor({ encounter, onUpdate }: ArtVariantsEditorProps) {
  const art = encounter.art ?? {};

  const updateArtField = (key: keyof Omit<EncounterArt, 'phases'>, value: string) => {
    const nextArt: EncounterArt = { ...art };
    if (value.trim() === '') {
      delete nextArt[key];
    } else {
      nextArt[key] = value;
    }
    onUpdate({
      ...encounter,
      art: nextArt,
    });
  };

  const handleUpload = (
    key: keyof Omit<EncounterArt, 'phases'>,
    e: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        updateArtField(key, reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <details className="inspector-advanced" data-testid="art-variants-editor">
      <summary>Art variants (optional)</summary>
      <div className="inspector-advanced-body">
        {VARIANT_FIELDS.map(({ key, label }) => (
          <div key={key} className="inspector-field">
            <label htmlFor={`art-variant-${key}`}>{label}</label>
            <input
              id={`art-variant-${key}`}
              type="text"
              placeholder="Optional image URL or data URI"
              value={art[key] ?? ''}
              onChange={(e) => updateArtField(key, e.target.value)}
            />
            <input
              type="file"
              accept="image/*"
              aria-label={`Upload ${label}`}
              onChange={(e) => handleUpload(key, e)}
            />
          </div>
        ))}
      </div>
    </details>
  );
}
