import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type OnConnectEnd,
  type OnConnectStart,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { deleteNode, saveStory, setExitTarget } from '../story/store';
import type { Story, StoryNode } from '../story/types';
import { validateStory } from '../story/validation';
import { EncounterInspector } from './EncounterInspector';
import { EncounterNodeCard } from './EncounterNodeCard';
import { ImageLibraryPanel } from './ImageLibraryPanel';
import { ItemsPanel } from './ItemsPanel';
import { PassageInspector } from './PassageInspector';
import { PassageNodeCard } from './PassageNodeCard';
import { StorySettingsPanel } from './StorySettingsPanel';
import { ValidationPanel } from './ValidationPanel';
import {
  createAndLinkNodeFromHandle,
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

interface DropMenuState {
  sourceNodeId: string;
  sourceHandleId: string;
  left: number;
  top: number;
  flowPos: { x: number; y: number };
}

function BuilderInner({ story, onStoryChange }: StoryMapBuilderProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(story.startNodeId);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [sideTab, setSideTab] = useState<'inspector' | 'items' | 'images' | 'settings'>('inspector');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [dropMenu, setDropMenu] = useState<DropMenuState | null>(null);
  const flowWrapRef = useRef<HTMLDivElement | null>(null);
  const connectingRef = useRef<{ nodeId: string; handleId: string } | null>(null);
  const didConnectRef = useRef(false);
  const handledByRfRef = useRef(false);
  const domDragRef = useRef<{ nodeId: string; handleId: string; startX: number; startY: number } | null>(null);

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
      setSideTab('inspector');
      const target = story.nodes[nodeId];
      if (target && rfInstance) {
        rfInstance.setCenter(target.position.x + 110, target.position.y + 60, { zoom: 1 });
      }
    },
    [rfInstance, story.nodes],
  );

  const focusItem = useCallback((itemId: string) => {
    setSelectedItemId(itemId);
    setSideTab('items');
  }, []);

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
      didConnectRef.current = true;
      connectingRef.current = null;
      setDropMenu(null);
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

  const getViewportCenterPosition = useCallback(
    (fallback: { x: number; y: number }): { x: number; y: number } => {
      const wrapEl = flowWrapRef.current;
      if (rfInstance && wrapEl) {
        const rect = wrapEl.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          return rfInstance.screenToFlowPosition({
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
          });
        }
      }
      return fallback;
    },
    [rfInstance],
  );

  const openDropMenuAtPoint = useCallback(
    (nodeId: string, handleId: string, clientX: number, clientY: number) => {
      const wrapRect = flowWrapRef.current?.getBoundingClientRect();
      const left = wrapRect
        ? Math.max(12, Math.min(clientX - wrapRect.left, Math.max(160, wrapRect.width - 180)))
        : 120;
      const top = wrapRect
        ? Math.max(12, Math.min(clientY - wrapRect.top, Math.max(120, wrapRect.height - 130)))
        : 120;

      const sourcePos = story.nodes[nodeId]?.position ?? { x: 160, y: 160 };
      const flowPos =
        rfInstance && wrapRect && wrapRect.width > 0 && wrapRect.height > 0
          ? rfInstance.screenToFlowPosition({ x: clientX, y: clientY })
          : { x: sourcePos.x + 340, y: sourcePos.y };

      setDropMenu({
        sourceNodeId: nodeId,
        sourceHandleId: handleId,
        left,
        top,
        flowPos,
      });
    },
    [rfInstance, story.nodes],
  );

  const handleConnectStart: OnConnectStart = useCallback((_event, params) => {
    if (params.handleType === 'source' && params.nodeId && params.handleId) {
      connectingRef.current = { nodeId: params.nodeId, handleId: params.handleId };
      didConnectRef.current = false;
      handledByRfRef.current = false;
    } else {
      connectingRef.current = null;
    }
  }, []);

  const handleConnectEnd: OnConnectEnd = useCallback(
    (event, connectionState) => {
      handledByRfRef.current = true;
      domDragRef.current = null;
      const pending = connectingRef.current;
      connectingRef.current = null;
      if (!pending || didConnectRef.current || connectionState?.isValid) {
        return;
      }
      const targetEl = event.target instanceof Element ? event.target : null;
      if (targetEl?.closest('.react-flow__handle')) return;

      const touch = 'changedTouches' in event ? event.changedTouches[0] : null;
      const clientX = touch ? touch.clientX : 'clientX' in event ? event.clientX : 280;
      const clientY = touch ? touch.clientY : 'clientY' in event ? event.clientY : 180;
      openDropMenuAtPoint(pending.nodeId, pending.handleId, clientX, clientY);
    },
    [openDropMenuAtPoint],
  );

  useEffect(() => {
    const onMouseUp = (upEvent: MouseEvent) => {
      const drag = domDragRef.current;
      domDragRef.current = null;
      if (!drag || didConnectRef.current || handledByRfRef.current) return;
      if (Math.hypot(upEvent.clientX - drag.startX, upEvent.clientY - drag.startY) < 12) return;
      if (upEvent.target instanceof Element && upEvent.target.closest('.react-flow__handle')) {
        return;
      }
      openDropMenuAtPoint(drag.nodeId, drag.handleId, upEvent.clientX, upEvent.clientY);
    };
    document.addEventListener('mouseup', onMouseUp);
    return () => document.removeEventListener('mouseup', onMouseUp);
  }, [openDropMenuAtPoint]);

  useEffect(() => {
    if (!dropMenu) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDropMenu(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dropMenu]);

  const handleCreateFromDropMenu = (kind: 'passage' | 'encounter') => {
    if (!dropMenu) return;
    const { story: nextStory, createdNodeId } = createAndLinkNodeFromHandle(
      story,
      dropMenu.sourceNodeId,
      dropMenu.sourceHandleId,
      kind,
      dropMenu.flowPos,
    );
    commitStory(nextStory);
    setSelectedNodeId(createdNodeId);
    setSideTab('inspector');
    setDropMenu(null);
  };

  const handleAddEncounter = () => {
    const count = Object.keys(story.nodes).length + 1;
    let id = `enc_${count}`;
    while (story.nodes[id]) {
      id = `${id}_x`;
    }
    const pos = getViewportCenterPosition({ x: 180 + count * 25, y: 220 });
    const node = createDefaultEncounterNode(id, pos);
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
    const pos = getViewportCenterPosition({ x: 160 + count * 25, y: 140 });
    const node = createDefaultPassageNode(id, pos);
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
            aria-pressed={sideTab === 'items'}
            onClick={() => setSideTab((t) => (t === 'items' ? 'inspector' : 'items'))}
          >
            Items
          </button>
          <button
            type="button"
            aria-pressed={sideTab === 'images'}
            onClick={() => setSideTab((t) => (t === 'images' ? 'inspector' : 'images'))}
          >
            Images
          </button>
          <button
            type="button"
            aria-pressed={sideTab === 'settings'}
            onClick={() => setSideTab((t) => (t === 'settings' ? 'inspector' : 'settings'))}
          >
            Story settings
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

        <div
          className="builder-flow-wrap"
          ref={flowWrapRef}
          onMouseDownCapture={(e) => {
            if (e.button !== 0) return;
            const handle = (e.target instanceof Element ? e.target : null)?.closest(
              '.react-flow__handle.source',
            );
            const nodeId = handle?.getAttribute('data-nodeid');
            const handleId = handle?.getAttribute('data-handleid');
            if (nodeId && handleId) {
              domDragRef.current = { nodeId, handleId, startX: e.clientX, startY: e.clientY };
              didConnectRef.current = false;
              handledByRfRef.current = false;
            }
          }}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={handleNodesChange}
            onConnectStart={handleConnectStart}
            onConnect={handleConnect}
            onConnectEnd={handleConnectEnd}
            onEdgesDelete={handleEdgesDelete}
            onPaneClick={() => setDropMenu(null)}
            onNodeClick={(_e, node: Node) => {
              setDropMenu(null);
              setSelectedNodeId(node.id);
              setSideTab('inspector');
            }}
            onInit={setRfInstance}
            minZoom={0.35}
            fitViewOptions={{ padding: 0.18, maxZoom: 1 }}
            fitView
          >
            <Background />
            <Controls />
          </ReactFlow>

          {dropMenu && (
            <div
              className="builder-drop-menu"
              role="menu"
              aria-label="Create linked node"
              data-testid="drag-create-menu"
              style={{ left: dropMenu.left, top: dropMenu.top }}
            >
              <div className="builder-drop-menu__title">Link to new node</div>
              <button
                type="button"
                role="menuitem"
                onClick={() => handleCreateFromDropMenu('passage')}
              >
                New passage
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => handleCreateFromDropMenu('encounter')}
              >
                New encounter
              </button>
              <button
                type="button"
                role="menuitem"
                className="builder-drop-menu__cancel"
                onClick={() => setDropMenu(null)}
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        <ValidationPanel
          messages={validationMessages}
          onFocusNode={focusNode}
          onFocusItem={focusItem}
        />
      </div>

      <aside className="inspector-pane" aria-label="Node inspector">
        {sideTab === 'images' ? (
          <ImageLibraryPanel story={story} />
        ) : sideTab === 'settings' ? (
          <StorySettingsPanel story={story} onUpdateStory={commitStory} />
        ) : sideTab === 'items' ? (
          <ItemsPanel
            story={story}
            initialItemId={selectedItemId}
            onUpdateStory={commitStory}
          />
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
