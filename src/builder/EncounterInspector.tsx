import { useState, type ChangeEvent } from 'react';
import { BEHAVIOUR_PRESETS, TOUGHNESS_PRESETS, VALID_MOVES } from '../combat/constants';
import type {
  BehaviourPreset,
  Encounter,
  Move,
  TellClarity,
  ToughnessPreset,
} from '../combat/types';
import type { EncounterNode, Story } from '../story/types';
import { ArtVariantsEditor } from './ArtVariantsEditor';
import { BalancePreviewPanel } from './BalancePreviewPanel';
import { BossEditor } from './BossEditor';
import { CaptionEditor } from './CaptionEditor';
import { ImagePicker } from './ImagePicker';
import { StoryIntegrationEditor } from './StoryIntegrationEditor';

export interface EncounterInspectorProps {
  node: EncounterNode;
  story?: Story;
  storyId?: string;
  onUpdate: (nextEncounter: Encounter) => void;
}

type InspectorTab = 'enemy' | 'fight' | 'storyLinks' | 'outcomes' | 'boss';

/**
 * Tabbed encounter inspector keeping BalancePreviewPanel pinned and visible across all sections.
 */
export function EncounterInspector({
  node,
  story,
  storyId,
  onUpdate,
}: EncounterInspectorProps) {
  const { encounter } = node;
  const effectiveStoryId = story?.id ?? storyId;
  const isBoss = encounter.enemy.toughness === 'boss';
  const [activeTab, setActiveTab] = useState<InspectorTab>('enemy');
  const effectiveTab: InspectorTab = activeTab === 'boss' && !isBoss ? 'enemy' : activeTab;

  const handleNameChange = (e: ChangeEvent<HTMLInputElement>) => {
    onUpdate({
      ...encounter,
      enemy: { ...encounter.enemy, name: e.target.value },
    });
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

  const tabs: Array<{ id: InspectorTab; label: string }> = [
    { id: 'enemy', label: 'Enemy' },
    { id: 'fight', label: 'Fight' },
    { id: 'storyLinks', label: 'Story links' },
    { id: 'outcomes', label: 'Outcomes' },
    ...(isBoss ? [{ id: 'boss' as const, label: 'Boss' }] : []),
  ];

  return (
    <div className="inspector-form" data-testid="encounter-inspector">
      <h2>{encounter.enemy.name || 'Unnamed Enemy'}</h2>

      <div className="inspector-tabs" role="tablist" aria-label="Encounter sections">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            className={`inspector-tab ${effectiveTab === tab.id ? 'is-active' : ''}`}
            aria-selected={effectiveTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="inspector-tab-panel" role="tabpanel" aria-label={tabs.find((t) => t.id === effectiveTab)?.label}>
        {effectiveTab === 'enemy' && (
          <div className="inspector-tab-section">
            <h3 className="inspector-section-heading">Enemy setup</h3>
            <p className="inspector-help-text">
              Set the foe&apos;s name, main illustration, overall strength tier, and optional state artwork.
            </p>

            <div className="inspector-field">
              <label htmlFor="enc-enemy-name">Enemy name</label>
              <input
                id="enc-enemy-name"
                type="text"
                value={encounter.enemy.name}
                onChange={handleNameChange}
              />
            </div>

            <ImagePicker
              label="Enemy image"
              value={encounter.enemy.image || undefined}
              story={story}
              storyId={effectiveStoryId}
              onChange={(imageId) =>
                onUpdate({
                  ...encounter,
                  enemy: { ...encounter.enemy, image: imageId ?? '' },
                })
              }
              testId="enc-enemy-image-picker"
            />

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

            <ArtVariantsEditor
              encounter={encounter}
              story={story}
              storyId={effectiveStoryId}
              onUpdate={onUpdate}
            />
          </div>
        )}

        {effectiveTab === 'fight' && (
          <div className="inspector-tab-section">
            <h3 className="inspector-section-heading">Fight rhythm</h3>
            <p className="inspector-help-text">
              Choose how this enemy fights, whether readers see clear tells or can retreat, and custom beat text.
            </p>

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
          </div>
        )}

        {effectiveTab === 'storyLinks' && (
          <div className="inspector-tab-section">
            <h3 className="inspector-section-heading">Story links</h3>
            <p className="inspector-help-text">
              Adjust the fight using earlier flags or items, and insert mid-fight story moments with choices.
            </p>
            <StoryIntegrationEditor
              encounter={encounter}
              story={story}
              section="storyLinks"
              onUpdate={onUpdate}
            />
          </div>
        )}

        {effectiveTab === 'outcomes' && (
          <div className="inspector-tab-section">
            <h3 className="inspector-section-heading">Outcomes &amp; exits</h3>
            <p className="inspector-help-text">
              Define custom fight exits and pick items, flags, rest, or wounds applied when the fight ends.
            </p>
            <StoryIntegrationEditor
              encounter={encounter}
              story={story}
              section="outcomes"
              onUpdate={onUpdate}
            />
          </div>
        )}

        {effectiveTab === 'boss' && isBoss && (
          <div className="inspector-tab-section">
            <h3 className="inspector-section-heading">Boss rules &amp; phases</h3>
            <p className="inspector-help-text">
              Configure multi-phase pattern shifts, alternate win conditions, and rule-breaking mechanics.
            </p>
            <BossEditor
              encounter={encounter}
              story={story}
              storyId={effectiveStoryId}
              onUpdate={onUpdate}
            />
          </div>
        )}
      </div>

      <div className="inspector-pinned-preview" data-testid="pinned-balance-preview">
        <BalancePreviewPanel encounter={encounter} />
      </div>
    </div>
  );
}
