import type { PassageNode } from '../story/types';

export interface PassageInspectorProps {
  node: PassageNode;
  onUpdate: (nextNode: PassageNode) => void;
}

export function PassageInspector({ node, onUpdate }: PassageInspectorProps) {
  const hasRest = Boolean(node.effects?.some((e) => 'rest' in e && e.rest));

  const toggleRest = (enabled: boolean) => {
    const existing = (node.effects ?? []).filter((e) => !('rest' in e));
    const nextEffects = enabled ? [...existing, { rest: true as const }] : existing;
    onUpdate({
      ...node,
      effects: nextEffects,
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
        <span className="inspector-label">Choices</span>
        {node.choices.map((choice, idx) => (
          <div key={choice.id} className="pattern-editor-row">
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
          </div>
        ))}
      </div>
    </div>
  );
}
