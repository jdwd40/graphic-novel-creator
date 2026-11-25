import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { PassageNode } from '../story/types';

export interface PassageFlowData extends Record<string, unknown> {
  passage: PassageNode;
  isStart?: boolean;
  selected?: boolean;
}

export type PassageFlowNode = Node<PassageFlowData, 'passage'>;

export function PassageNodeCard({ data, selected }: NodeProps<PassageFlowNode>) {
  const { passage, isStart } = data;
  return (
    <div
      className={`story-node story-node--passage ${selected ? 'is-selected' : ''}`}
      data-testid={`passage-node-${passage.id}`}
    >
      <Handle type="target" position={Position.Left} id="in" aria-label="Incoming story link" />
      <div className="story-node__header">
        <span className="story-node__badge">Passage</span>
        {isStart && <span className="story-node__badge story-node__badge--start">Start</span>}
        {passage.isEnding && <span className="story-node__badge story-node__badge--end">Ending</span>}
      </div>
      <div className="story-node__title">{passage.title}</div>
      <div className="story-node__outputs">
        {passage.choices.map((choice) => (
          <div key={choice.id} className="story-node__output-row">
            <span className="story-node__output-label">{choice.label}</span>
            <Handle
              type="source"
              position={Position.Right}
              id={choice.id}
              aria-label={`Choice ${choice.label}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
