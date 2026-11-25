import type { PassageChoice, PassageNode, Story } from '../story/types';

export interface PassageInspectorProps {
  node: PassageNode;
  story?: Story;
  onUpdate: (nextNode: PassageNode) => void;
}

export function PassageInspector({ node, story, onUpdate }: PassageInspectorProps) {
  const hasRest = Boolean(node.effects?.some((e) => 'rest' in e && e.rest));

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
      <h2>{node.title}</h2>
      <div className="inspector-field">
        <label htmlFor="passage-title">Passage title</label>
        <input
          id="passage-title"
          type="text"
          value={node.title}
          onChange={(e) => onUpdate({ ...node, title: e.target.value })}
        />
      </div>
      <div className="inspector-field">
        <label htmlFor="passage-text">Passage text</label>
        <textarea
          id="passage-text"
          rows={4}
          value={node.text}
          onChange={(e) => onUpdate({ ...node, text: e.target.value })}
        />
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
          </div>
        ))}
      </div>
    </div>
  );
}
