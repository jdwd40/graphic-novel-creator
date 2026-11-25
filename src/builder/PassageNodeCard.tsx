import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { PassageNode } from '../story/types';
import { useImageUrl } from '../story/useImageUrl';

const HANDLE_STYLE = { width: 16, height: 16 };

export interface PassageFlowData extends Record<string, unknown> {
  passage: PassageNode;
  isStart?: boolean;
  selected?: boolean;
}

export type PassageFlowNode = Node<PassageFlowData, 'passage'>;

export function PassageNodeCard({ data, selected }: NodeProps<PassageFlowNode>) {
  const { passage, isStart } = data;
  const thumbSrc = useImageUrl(passage.image);
  const stateClasses = [
    'story-node',
    'story-node--passage',
    selected ? 'is-selected' : '',
    isStart ? 'story-node--start' : '',
    passage.isEnding ? 'story-node--ending' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={stateClasses}
      data-testid={`passage-node-${passage.id}`}
    >
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        style={HANDLE_STYLE}
        aria-label="Incoming story link"
      />
      <div className="story-node__header">
        <span className="story-node__badge">Passage</span>
        {isStart && <span className="story-node__badge story-node__badge--start">Start</span>}
        {passage.isEnding && <span className="story-node__badge story-node__badge--end">Ending</span>}
      </div>
      {thumbSrc && (
        <img
          src={thumbSrc}
          alt={passage.title}
          className="story-node__passage-thumb"
          data-testid={`passage-thumb-${passage.id}`}
        />
      )}
      <div className="story-node__title">{passage.title}</div>
      <div className="story-node__outputs">
        {passage.choices.map((choice) => {
          const hasCondition = Boolean(choice.condition);
          const hasEffects = Boolean(choice.effects && choice.effects.length > 0);
          return (
            <div key={choice.id} className="story-node__output-row">
              <span className="story-node__output-markers">
                {hasCondition && (
                  <span
                    className="story-node__marker"
                    title="Conditional choice"
                    aria-label="Conditional choice"
                    data-testid={`choice-lock-${choice.id}`}
                  >
                    🔒
                  </span>
                )}
                {hasEffects && (
                  <span
                    className="story-node__marker"
                    title="Choice grants effects"
                    aria-label="Choice grants effects"
                    data-testid={`choice-gift-${choice.id}`}
                  >
                    🎁
                  </span>
                )}
              </span>
              <span className="story-node__output-label">{choice.label}</span>
              <Handle
                type="source"
                position={Position.Right}
                id={choice.id}
                style={HANDLE_STYLE}
                aria-label={`Choice ${choice.label}`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
