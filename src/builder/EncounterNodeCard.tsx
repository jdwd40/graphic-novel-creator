import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { EncounterNode } from '../story/types';

export interface EncounterFlowData extends Record<string, unknown> {
  encounterNode: EncounterNode;
}

export type EncounterFlowNode = Node<EncounterFlowData, 'encounter'>;

function formatExitLabel(exitKey: string, customLabel?: string): string {
  if (customLabel) return customLabel;
  return exitKey.charAt(0).toUpperCase() + exitKey.slice(1);
}

export function getVisibleEncounterExitKeys(encounterNode: EncounterNode): string[] {
  return Object.keys(encounterNode.encounter.exits).filter((key) => {
    if (key === 'retreat' && !encounterNode.encounter.allowRetreat) {
      return false;
    }
    return true;
  });
}

export function EncounterNodeCard({ data, selected }: NodeProps<EncounterFlowNode>) {
  const { encounterNode } = data;
  const { encounter } = encounterNode;
  const exitKeys = getVisibleEncounterExitKeys(encounterNode);

  return (
    <div
      className={`story-node story-node--encounter ${selected ? 'is-selected' : ''}`}
      data-testid={`encounter-node-${encounterNode.id}`}
    >
      <Handle type="target" position={Position.Left} id="in" aria-label="Incoming story link" />
      <div className="story-node__encounter-top">
        <img
          src={encounter.enemy.image}
          alt={encounter.enemy.name}
          className="story-node__thumb"
        />
        <div className="story-node__encounter-meta">
          <span className="story-node__badge story-node__badge--encounter">
            {encounter.enemy.toughness}
          </span>
          <div className="story-node__title">{encounter.enemy.name}</div>
        </div>
      </div>

      <div className="story-node__outputs">
        {exitKeys.map((exitKey) => {
          const label = formatExitLabel(exitKey, encounter.exits[exitKey]?.label);
          return (
            <div key={exitKey} className="story-node__output-row">
              <span className="story-node__output-label">{label}</span>
              <Handle
                type="source"
                position={Position.Right}
                id={exitKey}
                data-handle-exit={exitKey}
                aria-label={`${label} exit`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
