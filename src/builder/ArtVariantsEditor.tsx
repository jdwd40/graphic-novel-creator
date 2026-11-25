import type { Encounter, EncounterArt } from '../combat/types';
import type { Story } from '../story/types';
import { ImagePicker } from './ImagePicker';

export interface ArtVariantsEditorProps {
  encounter: Encounter;
  story?: Story;
  storyId?: string;
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

export function ArtVariantsEditor({
  encounter,
  story,
  storyId,
  onUpdate,
}: ArtVariantsEditorProps) {
  const art = encounter.art ?? {};

  const updateArtField = (
    key: keyof Omit<EncounterArt, 'phases'>,
    value: string | undefined,
  ) => {
    const nextArt: EncounterArt = { ...art };
    if (!value) {
      delete nextArt[key];
    } else {
      nextArt[key] = value;
    }
    onUpdate({
      ...encounter,
      art: nextArt,
    });
  };

  return (
    <details className="inspector-advanced" data-testid="art-variants-editor">
      <summary>Art variants (optional)</summary>
      <div className="inspector-advanced-body">
        {VARIANT_FIELDS.map(({ key, label }) => (
          <ImagePicker
            key={key}
            label={label}
            value={art[key]}
            story={story}
            storyId={storyId}
            onChange={(imageId) => updateArtField(key, imageId)}
            testId={`art-variant-picker-${key}`}
          />
        ))}
      </div>
    </details>
  );
}
