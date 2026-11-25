import { useCallback, useMemo, useState } from 'react';
import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { deleteNode, saveStory, setExitTarget } from '../story/store';
import type { Story, StoryNode } from '../story/types';
import { validateStory } from '../story/validation';
import { EncounterInspector } from './EncounterInspector';
import { EncounterNodeCard } from './EncounterNodeCard';
import { ImageLibraryPanel } from './ImageLibraryPanel';
import { PassageInspector } from './PassageInspector';
import { PassageNodeCard } from './PassageNodeCard';
import { ValidationPanel } from './ValidationPanel';
import {
  createDefaultEncounterNode,
  createDefaultPassageNode,
  storyToFlowEdges,
  storyToFlowNodes,
} from './graphUtils';
import './builder.css';

const nodeTypes = {
  passage: PassageNodeCard,
  encounter: EncounterNodeCard,
};

export interface StoryMapBuilderProps {
  story: Story;
  onStoryChange: (nextStory: Story) => void;
}

function BuilderInner({ story, onStoryChange }: StoryMapBuilderProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(story.startNodeId);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [sideTab, setSideTab] = useState<'inspector' | 'images'>('inspector');

  const nodes = useMemo(() => storyToFlowNodes(story, selectedNodeId), [story, selectedNodeId]);
  const edges = useMemo(() => storyToFlowEdges(story), [story]);
  const validationMessages = useMemo(() => validateStory(story), [story]);

  const commitStory = useCallback(
    (next: Story) => {
      try {
        saveStory(next);
        setSaveError(null);
      } catch (err) {
        setSaveError(
          err instanceof Error
            ? err.message
            : 'Unable to save story changes to browser storage.',
        );
      }
      onStoryChange(next);
    },
    [onStoryChange],
  );

  const focusNode = useCallback(
    (nodeId: string) => {
      setSelectedNodeId(nodeId);
      const target = story.nodes[nodeId];
      if (target && rfInstance) {
        rfInstance.setCenter(target.position.x + 110, target.position.y + 60, { zoom: 1 });
      }
    },
    [rfInstance, story.nodes],
  );

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      let updatedNodes: Record<string, StoryNode> | null = null;
      let nextSelected = selectedNodeId;

      for (const change of changes) {
        if (change.type === 'position' && change.position && story.nodes[change.id]) {
          if (!updatedNodes) updatedNodes = { ...story.nodes };
          updatedNodes[change.id] = {
            ...updatedNodes[change.id],
            position: { x: change.position.x, y: change.position.y },
          };
        } else if (change.type === 'select') {
          if (change.selected) {
            nextSelected = change.id;
          } else if (nextSelected === change.id) {
            nextSelected = null;
          }
        } else if (change.type === 'remove') {
          const cleaned = deleteNode(
            updatedNodes ? { ...story, nodes: updatedNodes } : story,
            change.id,
          );
          updatedNodes = cleaned.nodes;
          if (nextSelected === change.id) {
            nextSelected = null;
          }
        }
      }

      if (nextSelected !== selectedNodeId) {
        setSelectedNodeId(nextSelected);
      }
      if (updatedNodes) {
        commitStory({ ...story, nodes: updatedNodes });
      }
    },
    [commitStory, selectedNodeId, story],
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target || !connection.sourceHandle) return;
      const sourceNode = story.nodes[connection.source];
      if (!sourceNode) return;

      if (sourceNode.kind === 'encounter') {
        const next = setExitTarget(
          story,
          sourceNode.id,
          connection.sourceHandle,
          connection.target,
        );
        commitStory(next);
      } else {
        const nextNode: StoryNode = {
          ...sourceNode,
          choices: sourceNode.choices.map((c) =>
            c.id === connection.sourceHandle ? { ...c, targetNodeId: connection.target } : c,
          ),
        };
        commitStory({
          ...story,
          nodes: { ...story.nodes, [sourceNode.id]: nextNode },
        });
      }
    },
    [commitStory, story],
  );

  const handleEdgesDelete = useCallback(
    (deletedEdges: Edge[]) => {
      let current = story;
      for (const edge of deletedEdges) {
        if (!edge.sourceHandle) continue;
        const sourceNode = current.nodes[edge.source];
        if (!sourceNode) continue;

        if (sourceNode.kind === 'encounter') {
          current = setExitTarget(current, sourceNode.id, edge.sourceHandle, null);
        } else {
          current = {
            ...current,
            nodes: {
              ...current.nodes,
              [sourceNode.id]: {
                ...sourceNode,
                choices: sourceNode.choices.map((c) =>
                  c.id === edge.sourceHandle ? { ...c, targetNodeId: null } : c,
                ),
              },
            },
          };
        }
      }
      commitStory(current);
    },
    [commitStory, story],
  );

  const handleAddEncounter = () => {
    const count = Object.keys(story.nodes).length + 1;
    let id = `enc_${count}`;
    while (story.nodes[id]) {
      id = `${id}_x`;
    }
    const node = createDefaultEncounterNode(id, { x: 180 + count * 25, y: 220 });
    commitStory({
      ...story,
      nodes: { ...story.nodes, [id]: node },
    });
    setSelectedNodeId(id);
  };

  const handleAddPassage = () => {
    const count = Object.keys(story.nodes).length + 1;
    let id = `passage_${count}`;
    while (story.nodes[id]) {
      id = `${id}_x`;
    }
    const node = createDefaultPassageNode(id, { x: 160 + count * 25, y: 140 });
    commitStory({
      ...story,
      nodes: { ...story.nodes, [id]: node },
    });
    setSelectedNodeId(id);
  };

  const handleDeleteSelected = () => {
    if (!selectedNodeId || selectedNodeId === story.startNodeId) return;
    const next = deleteNode(story, selectedNodeId);
    setSelectedNodeId(story.startNodeId);
    commitStory(next);
  };

  const selectedNode = selectedNodeId ? story.nodes[selectedNodeId] ?? null : null;

  return (
    <div className="builder-layout">
      <div className="builder-canvas-pane">
        <div className="builder-toolbar" role="toolbar" aria-label="Story map actions">
          <button type="button" className="btn-primary" onClick={handleAddEncounter}>
            Add encounter
          </button>
          <button type="button" onClick={handleAddPassage}>
            Add passage
          </button>
          <button
            type="button"
            className="btn-danger"
            disabled={!selectedNode || selectedNode.id === story.startNodeId}
            onClick={handleDeleteSelected}
          >
            Delete selected
          </button>
          <button
            type="button"
            aria-pressed={sideTab === 'images'}
            onClick={() => setSideTab((t) => (t === 'images' ? 'inspector' : 'images'))}
          >
            {sideTab === 'images' ? 'Inspector' : 'Images'}
          </button>
        </div>

        {saveError && (
          <div
            role="alert"
            data-testid="story-save-error"
            style={{
              background: '#fef2f2',
              color: '#991b1b',
              borderBottom: '1px solid #fecaca',
              padding: '0.5rem 0.75rem',
              fontSize: '0.85rem',
            }}
          >
            <strong>Save error:</strong> {saveError}
          </div>
        )}

        <div className="builder-flow-wrap">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={handleNodesChange}
            onConnect={handleConnect}
            onEdgesDelete={handleEdgesDelete}
            onNodeClick={(_e, node: Node) => {
              setSelectedNodeId(node.id);
              setSideTab('inspector');
            }}
            onInit={setRfInstance}
            fitView
          >
            <Background />
            <Controls />
          </ReactFlow>
        </div>

        <ValidationPanel messages={validationMessages} onFocusNode={focusNode} />
      </div>

      <aside className="inspector-pane" aria-label="Node inspector">
        {sideTab === 'images' ? (
          <ImageLibraryPanel story={story} />
        ) : selectedNode ? (
          <>
            {rfInstance && (
              <button
                type="button"
                onClick={() => focusNode(selectedNode.id)}
              >
                Center on canvas
              </button>
            )}
            {selectedNode.kind === 'encounter' ? (
              <EncounterInspector
                key={selectedNode.id}
                node={selectedNode}
                story={story}
                storyId={story.id}
                onUpdate={(nextEncounter) => {
                  const nextExitTargets: Record<string, string | null> = {};
                  for (const exitKey of Object.keys(nextEncounter.exits)) {
                    if (exitKey === 'retreat' && !nextEncounter.allowRetreat) continue;
                    nextExitTargets[exitKey] = selectedNode.exitTargets[exitKey] ?? null;
                  }
                  const next: Story = {
                    ...story,
                    nodes: {
                      ...story.nodes,
                      [selectedNode.id]: {
                        ...selectedNode,
                        title: nextEncounter.enemy.name || selectedNode.title,
                        encounter: nextEncounter,
                        exitTargets: nextExitTargets,
                      },
                    },
                  };
                  commitStory(next);
                }}
              />
            ) : (
              <PassageInspector
                key={selectedNode.id}
                node={selectedNode}
                story={story}
                onUpdate={(nextPassage) => {
                  commitStory({
                    ...story,
                    nodes: { ...story.nodes, [selectedNode.id]: nextPassage },
                  });
                }}
                onSetStart={(nodeId) => {
                  commitStory({
                    ...story,
                    startNodeId: nodeId,
                  });
                }}
              />
            )}
          </>
        ) : (
          <p>Select a passage or encounter node on the story map.</p>
        )}
      </aside>
    </div>
  );
}

export function StoryMapBuilder(props: StoryMapBuilderProps) {
  return (
    <ReactFlowProvider>
      <BuilderInner {...props} />
    </ReactFlowProvider>
  );
}
