import type { ChangeEvent } from 'react';
import { BEHAVIOUR_PRESETS, TOUGHNESS_PRESETS, VALID_MOVES } from '../combat/constants';
import type {
  BehaviourPreset,
  Encounter,
  Move,
  TellClarity,
  ToughnessPreset,
} from '../combat/types';
import type { EncounterNode } from '../story/types';
import { BalancePreviewPanel } from './BalancePreviewPanel';
import { CaptionEditor } from './CaptionEditor';
import { StoryIntegrationEditor } from './StoryIntegrationEditor';

export interface EncounterInspectorProps {
  node: EncounterNode;
  onUpdate: (nextEncounter: Encounter) => void;
}

export function EncounterInspector({ node, onUpdate }: EncounterInspectorProps) {
  const { encounter } = node;

  const handleNameChange = (e: ChangeEvent<HTMLInputElement>) => {
    onUpdate({
      ...encounter,
      enemy: { ...encounter.enemy, name: e.target.value },
    });
  };

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    onUpdate({
      ...encounter,
      enemy: { ...encounter.enemy, image: e.target.value },
    });
  };

  const handleImageFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onUpdate({
          ...encounter,
          enemy: { ...encounter.enemy, image: reader.result },
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleToughnessChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const toughness = e.target.value as ToughnessPreset;
    const preset = TOUGHNESS_PRESETS[toughness];
    onUpdate({
      ...encounter,
      enemy: {
        ...encounter.enemy,
        toughness,
        health: preset.health,
        hit: preset.hit,
      },
      tellClarity: preset.tellClarity,
    });
  };

  const handleBehaviourChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const behaviour = e.target.value as BehaviourPreset;
    if (behaviour === 'custom') {
      onUpdate({
        ...encounter,
        behaviour: 'custom',
      });
      return;
    }
    onUpdate({
      ...encounter,
      behaviour,
      pattern: [...BEHAVIOUR_PRESETS[behaviour]],
    });
  };

  const handlePatternMoveChange = (index: number, move: Move) => {
    const nextPattern = encounter.pattern.map((m, i) => (i === index ? move : m));
    onUpdate({
      ...encounter,
      behaviour: 'custom',
      pattern: nextPattern,
    });
  };

  const handleAddPatternMove = () => {
    onUpdate({
      ...encounter,
      behaviour: 'custom',
      pattern: [...encounter.pattern, 'strike'],
    });
  };

  const handleRemovePatternMove = (index: number) => {
    if (encounter.pattern.length <= 1) return;
    onUpdate({
      ...encounter,
      behaviour: 'custom',
      pattern: encounter.pattern.filter((_, i) => i !== index),
    });
  };

  const handleShiftyToggle = (enabled: boolean) => {
    onUpdate({
      ...encounter,
      altPattern: enabled ? [...encounter.pattern] : null,
    });
  };

  const handleAltPatternMoveChange = (index: number, move: Move) => {
    if (!encounter.altPattern) return;
    onUpdate({
      ...encounter,
      altPattern: encounter.altPattern.map((m, i) => (i === index ? move : m)),
    });
  };

  return (
    <div className="inspector-form" data-testid="encounter-inspector">
      <h2>{encounter.enemy.name || 'Unnamed Enemy'}</h2>

      <div className="inspector-field">
        <label htmlFor="enc-enemy-name">Enemy name</label>
        <input
          id="enc-enemy-name"
          type="text"
          value={encounter.enemy.name}
          onChange={handleNameChange}
        />
      </div>

      <div className="inspector-field">
        <label htmlFor="enc-enemy-image">Enemy image</label>
        <input
          id="enc-enemy-image"
          type="text"
          value={encounter.enemy.image}
          onChange={handleImageChange}
        />
        <label htmlFor="enc-enemy-image-upload" className="inspector-sublabel">
          Upload image file
        </label>
        <input
          id="enc-enemy-image-upload"
          type="file"
          accept="image/*"
          onChange={handleImageFileUpload}
        />
      </div>

      <div className="inspector-field">
        <label htmlFor="enc-toughness">Toughness</label>
        <select
          id="enc-toughness"
          value={encounter.enemy.toughness}
          onChange={handleToughnessChange}
        >
          <option value="weak">Weak (5 HP, Hit 1)</option>
          <option value="standard">Standard (8 HP, Hit 1)</option>
          <option value="tough">Tough (12 HP, Hit 2)</option>
          <option value="boss">Boss (16 HP, Hit 2)</option>
        </select>
      </div>

      <div className="inspector-field">
        <label htmlFor="enc-behaviour">Behaviour</label>
        <select
          id="enc-behaviour"
          value={encounter.behaviour}
          onChange={handleBehaviourChange}
        >
          <option value="brawler">Brawler (Strike, Strike, Heavy)</option>
          <option value="brute">Brute (Strike, Heavy)</option>
          <option value="skirmisher">Skirmisher (Strike, Strike, Strike, Open)</option>
          <option value="custom">Custom</option>
        </select>
      </div>

      <details className="inspector-advanced">
        <summary>Advanced encounter settings</summary>

        <div className="inspector-advanced-body">
          <div className="inspector-field">
            <span className="inspector-label">Pattern moves</span>
            <ul className="pattern-editor-list">
              {encounter.pattern.map((move, idx) => (
                <li key={`${idx}-${move}`} className="pattern-editor-row">
                  <select
                    aria-label={`Pattern move ${idx + 1}`}
                    value={move}
                    onChange={(e) => handlePatternMoveChange(idx, e.target.value as Move)}
                  >
                    {VALID_MOVES.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={encounter.pattern.length <= 1}
                    aria-label={`Remove move ${idx + 1}`}
                    onClick={() => handleRemovePatternMove(idx)}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" onClick={handleAddPatternMove}>
              Add pattern move
            </button>
          </div>

          <div className="inspector-field">
            <label htmlFor="enc-tell-clarity">Tell clarity</label>
            <select
              id="enc-tell-clarity"
              value={encounter.tellClarity}
              onChange={(e) =>
                onUpdate({
                  ...encounter,
                  tellClarity: e.target.value as TellClarity,
                })
              }
            >
              <option value="clear">Clear</option>
              <option value="vague">Vague</option>
              <option value="hidden">Hidden</option>
            </select>
          </div>

          <div className="inspector-checkbox">
            <input
              id="enc-allow-retreat"
              type="checkbox"
              checked={encounter.allowRetreat}
              onChange={(e) =>
                onUpdate({
                  ...encounter,
                  allowRetreat: e.target.checked,
                })
              }
            />
            <label htmlFor="enc-allow-retreat">Allow retreat</label>
          </div>

          <div className="inspector-checkbox">
            <input
              id="enc-shifty-toggle"
              type="checkbox"
              checked={Boolean(encounter.altPattern)}
              onChange={(e) => handleShiftyToggle(e.target.checked)}
            />
            <label htmlFor="enc-shifty-toggle">Shifty (alternate pattern)</label>
          </div>

          {encounter.altPattern && (
            <div className="inspector-field">
              <span className="inspector-label">Alternate pattern</span>
              <ul className="pattern-editor-list">
                {encounter.altPattern.map((move, idx) => (
                  <li key={`alt-${idx}-${move}`} className="pattern-editor-row">
                    <select
                      aria-label={`Alternate move ${idx + 1}`}
                      value={move}
                      onChange={(e) =>
                        handleAltPatternMoveChange(idx, e.target.value as Move)
                      }
                    >
                      {VALID_MOVES.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </details>

      <CaptionEditor encounter={encounter} onUpdate={onUpdate} />

      <StoryIntegrationEditor encounter={encounter} onUpdate={onUpdate} />

      <BalancePreviewPanel encounter={encounter} />
    </div>
  );
}
