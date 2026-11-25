import type { PassageChoice, PassageNode, Story } from '../story/types';
import { ConditionEditor, EffectsListEditor } from './ConditionEffectEditors';
import { ImagePicker } from './ImagePicker';

export interface PassageInspectorProps {
  node: PassageNode;
  story?: Story;
  onUpdate: (nextNode: PassageNode) => void;
  onSetStart?: (nodeId: string) => void;
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export function PassageInspector({ node, story, onUpdate, onSetStart }: PassageInspectorProps) {
  const hasRest = Boolean(node.effects?.some((e) => 'rest' in e && e.rest));
  const isStart = story ? story.startNodeId === node.id : false;
  const wordCount = countWords(node.text);

  const toggleRest = (enabled: boolean) => {
    const existing = (node.effects ?? []).filter((e) => !('rest' in e));
    const nextEffects = enabled ? [...existing, { rest: true as const }] : existing;
    onUpdate({
      ...node,
      effects: nextEffects,
    });
  };

  const targetNodes = story
    ? Object.values(story.nodes)
    : [];

  const handleAddChoice = () => {
    let idx = node.choices.length + 1;
    let id = `${node.id}_c${idx}`;
    const existingIds = new Set(node.choices.map((c) => c.id));
    while (existingIds.has(id)) {
      idx += 1;
      id = `${node.id}_c${idx}`;
    }
    const nextChoice: PassageChoice = {
      id,
      label: `Choice ${node.choices.length + 1}`,
      targetNodeId: null,
    };
    onUpdate({
      ...node,
      choices: [...node.choices, nextChoice],
    });
  };

  const handleMoveChoice = (index: number, delta: -1 | 1) => {
    const targetIndex = index + delta;
    if (targetIndex < 0 || targetIndex >= node.choices.length) return;
    const nextChoices = [...node.choices];
    const [moved] = nextChoices.splice(index, 1);
    nextChoices.splice(targetIndex, 0, moved);
    onUpdate({
      ...node,
      choices: nextChoices,
    });
  };

  const handleDeleteChoice = (index: number) => {
    onUpdate({
      ...node,
      choices: node.choices.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="inspector-form" data-testid="passage-inspector">
      <div className="integration-row-head">
        <h2>{node.title}</h2>
        {onSetStart && (
          <button
            type="button"
            disabled={isStart}
            onClick={() => onSetStart(node.id)}
          >
            {isStart ? 'Start passage' : 'Set as start'}
          </button>
        )}
      </div>

      <div className="inspector-field">
        <label htmlFor="passage-title">Passage title</label>
        <input
          id="passage-title"
          type="text"
          value={node.title}
          onChange={(e) => onUpdate({ ...node, title: e.target.value })}
        />
      </div>

      <ImagePicker
        label="Passage image"
        value={node.image}
        story={story}
        onChange={(imageId) => onUpdate({ ...node, image: imageId })}
        testId="passage-image-picker"
      />

      <div className="inspector-field">
        <div className="integration-row-head">
          <label htmlFor="passage-text">Passage text</label>
          <span className="inspector-sublabel" data-testid="passage-word-count">
            {wordCount} {wordCount === 1 ? 'word' : 'words'}
          </span>
        </div>
        <textarea
          id="passage-text"
          rows={7}
          style={{ resize: 'vertical' }}
          value={node.text}
          onChange={(e) => onUpdate({ ...node, text: e.target.value })}
        />
      </div>

      <div className="inspector-checkbox">
        <input
          id="passage-ending-toggle"
          type="checkbox"
          checked={Boolean(node.isEnding)}
          onChange={(e) =>
            onUpdate({
              ...node,
              isEnding: e.target.checked,
            })
          }
        />
        <label htmlFor="passage-ending-toggle">This is an ending</label>
      </div>

      <div className="inspector-checkbox">
        <input
          id="passage-rest-toggle"
          type="checkbox"
          checked={hasRest}
          onChange={(e) => toggleRest(e.target.checked)}
        />
        <label htmlFor="passage-rest-toggle">Rest here (restore full health)</label>
      </div>

      <EffectsListEditor
        label="Passage effects (when entered)"
        effects={node.effects ?? []}
        story={story}
        idPrefix="Passage"
        onChange={(nextEffects) =>
          onUpdate({
            ...node,
            effects: nextEffects,
          })
        }
      />

      <div className="inspector-field">
        <div className="integration-row-head">
          <span className="inspector-label">Choices ({node.choices.length})</span>
          <button type="button" onClick={handleAddChoice}>
            Add choice
          </button>
        </div>

        {node.choices.length === 0 && (
          <p className="inspector-sublabel">No choices yet. Add one or mark this passage as an ending.</p>
        )}

        {node.choices.map((choice, idx) => (
          <div
            key={choice.id}
            className="integration-card"
            data-testid={`passage-choice-row-${idx}`}
          >
            <div className="pattern-editor-row">
              <input
                type="text"
                aria-label={`Choice ${idx + 1} label`}
                value={choice.label}
                onChange={(e) =>
                  onUpdate({
                    ...node,
                    choices: node.choices.map((c, i) =>
                      i === idx ? { ...c, label: e.target.value } : c,
                    ),
                  })
                }
              />
              <button
                type="button"
                aria-label={`Move choice ${idx + 1} up`}
                disabled={idx === 0}
                onClick={() => handleMoveChoice(idx, -1)}
              >
                Up
              </button>
              <button
                type="button"
                aria-label={`Move choice ${idx + 1} down`}
                disabled={idx === node.choices.length - 1}
                onClick={() => handleMoveChoice(idx, 1)}
              >
                Down
              </button>
              <button
                type="button"
                className="btn-danger"
                aria-label={`Delete choice ${idx + 1}`}
                onClick={() => handleDeleteChoice(idx)}
              >
                Delete
              </button>
            </div>

            <div className="inspector-field">
              <label htmlFor={`choice-target-${choice.id}`}>Leads to</label>
              <select
                id={`choice-target-${choice.id}`}
                aria-label={`Choice ${idx + 1} target`}
                value={choice.targetNodeId ?? ''}
                onChange={(e) => {
                  const targetNodeId = e.target.value || null;
                  onUpdate({
                    ...node,
                    choices: node.choices.map((c, i) =>
                      i === idx ? { ...c, targetNodeId } : c,
                    ),
                  });
                }}
              >
                <option value="">(Not connected)</option>
                {targetNodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.title || n.id} ({n.kind})
                  </option>
                ))}
              </select>
            </div>

            <ConditionEditor
              label="Visibility condition"
              value={choice.condition}
              story={story}
              idPrefix={`Choice ${idx + 1}`}
              onChange={(nextCondition) =>
                onUpdate({
                  ...node,
                  choices: node.choices.map((c, i) =>
                    i === idx ? { ...c, condition: nextCondition } : c,
                  ),
                })
              }
            />

            <EffectsListEditor
              label="Choice effects"
              effects={choice.effects ?? []}
              story={story}
              idPrefix={`Choice ${idx + 1}`}
              onChange={(nextEffects) =>
                onUpdate({
                  ...node,
                  choices: node.choices.map((c, i) =>
                    i === idx ? { ...c, effects: nextEffects } : c,
                  ),
                })
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
}
