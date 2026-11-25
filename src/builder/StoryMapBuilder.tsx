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
import type { PlaythroughState } from '../story/playthrough';
import type { Story, StoryNode } from '../story/types';
import { validateStory } from '../story/validation';
import { EncounterInspector } from './EncounterInspector';
import { EncounterNodeCard } from './EncounterNodeCard';
import { ImageLibraryPanel } from './ImageLibraryPanel';
import { ItemsPanel } from './ItemsPanel';
import { PassageInspector } from './PassageInspector';
import { PassageNodeCard } from './PassageNodeCard';
import { PlayFromHereModal } from './PlayFromHereModal';
import { StorySettingsPanel } from './StorySettingsPanel';
import { ValidationPanel } from './ValidationPanel';
import { useStoryHistory } from './useStoryHistory';
import {
  createAndLinkNodeFromHandle,
  createDefaultEncounterNode,
  createDefaultPassageNode,
  storyToFlowEdges,
  storyToFlowNodes,
} from './graphUtils';
import './builder.css';

export function countNodeConnections(story: Story, nodeId: string): number {
  const node = story.nodes[nodeId];
  if (!node) return 0;
  let count = 0;

  if (node.kind === 'passage') {
    for (const c of node.choices) {
      if (c.targetNodeId && story.nodes[c.targetNodeId]) count += 1;
    }
  } else {
    for (const target of Object.values(node.exitTargets)) {
      if (target && story.nodes[target]) count += 1;
    }
  }

  for (const other of Object.values(story.nodes)) {
    if (other.id === nodeId) continue;
    if (other.kind === 'passage') {
      for (const c of other.choices) {
        if (c.targetNodeId === nodeId) count += 1;
      }
    } else {
      for (const target of Object.values(other.exitTargets)) {
        if (target === nodeId) count += 1;
      }
    }
  }
  return count;
}

const nodeTypes = {
  passage: PassageNodeCard,
  encounter: EncounterNodeCard,
};

export interface StoryMapBuilderProps {
  story: Story;
  initialSelectedNodeId?: string | null;
  onStoryChange: (nextStory: Story) => void;
  onPlayFromHere?: (playthrough: PlaythroughState, returnNodeId: string) => void;
}

interface DropMenuState {
  sourceNodeId: string;
  sourceHandleId: string;
  left: number;
  top: number;
  flowPos: { x: number; y: number };
}

function BuilderInner({
  story,
  initialSelectedNodeId,
  onStoryChange,
  onPlayFromHere,
}: StoryMapBuilderProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(() =>
    initialSelectedNodeId && story.nodes[initialSelectedNodeId]
      ? initialSelectedNodeId
      : story.startNodeId,
  );
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [sideTab, setSideTab] = useState<'inspector' | 'items' | 'images' | 'settings'>('inspector');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [dropMenu, setDropMenu] = useState<DropMenuState | null>(null);
  const [playFromHereOpen, setPlayFromHereOpen] = useState(false);
  const [pendingDeleteNodeId, setPendingDeleteNodeId] = useState<string | null>(null);
  const history = useStoryHistory(story.id);

  useEffect(() => {
    if (initialSelectedNodeId && story.nodes[initialSelectedNodeId]) {
      setSelectedNodeId(initialSelectedNodeId);
    }
  }, [initialSelectedNodeId, story.nodes]);
  const flowWrapRef = useRef<HTMLDivElement | null>(null);
  const connectingRef = useRef<{ nodeId: string; handleId: string } | null>(null);
  const didConnectRef = useRef(false);
  const handledByRfRef = useRef(false);
  const domDragRef = useRef<{ nodeId: string; handleId: string; startX: number; startY: number } | null>(null);

  const nodes = useMemo(() => storyToFlowNodes(story, selectedNodeId), [story, selectedNodeId]);
  const edges = useMemo(() => storyToFlowEdges(story), [story]);
  const validationMessages = useMemo(() => validateStory(story), [story]);

  const commitStory = useCallback(
    (next: Story, options?: { coalesceKey?: string; skipHistory?: boolean }) => {
      if (!options?.skipHistory) {
        history.pushChange(story, options?.coalesceKey);
      }
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
    [history, onStoryChange, story],
  );

  const handleUndo = useCallback(() => {
    const restored = history.undo(story);
    if (!restored) return;
    setPendingDeleteNodeId(null);
    setDropMenu(null);
    if (selectedNodeId && !restored.nodes[selectedNodeId]) {
      setSelectedNodeId(restored.startNodeId);
    }
    commitStory(restored, { skipHistory: true });
  }, [commitStory, history, selectedNodeId, story]);

  const handleRedo = useCallback(() => {
    const restored = history.redo(story);
    if (!restored) return;
    setPendingDeleteNodeId(null);
    setDropMenu(null);
    if (selectedNodeId && !restored.nodes[selectedNodeId]) {
      setSelectedNodeId(restored.startNodeId);
    }
    commitStory(restored, { skipHistory: true });
  }, [commitStory, history, selectedNodeId, story]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      const activeTag = document.activeElement?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        handleUndo();
      } else if ((key === 'z' && event.shiftKey) || key === 'y') {
        event.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleRedo, handleUndo]);

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

  const performDeleteNode = (nodeId: string) => {
    const next = deleteNode(story, nodeId);
    setPendingDeleteNodeId(null);
    setSelectedNodeId(story.startNodeId);
    commitStory(next);
  };

  const handleDeleteSelected = () => {
    if (!selectedNodeId || selectedNodeId === story.startNodeId) return;
    if (countNodeConnections(story, selectedNodeId) > 0) {
      setPendingDeleteNodeId(selectedNodeId);
      return;
    }
    performDeleteNode(selectedNodeId);
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
            disabled={!history.canUndo}
            onClick={handleUndo}
          >
            Undo
          </button>
          <button
            type="button"
            disabled={!history.canRedo}
            onClick={handleRedo}
          >
            Redo
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

        {pendingDeleteNodeId && story.nodes[pendingDeleteNodeId] && (
          <div
            role="alertdialog"
            aria-label="Confirm node deletion"
            className="builder-confirm-bar"
            data-testid="confirm-delete-node-dialog"
          >
            <span>
              Delete connected node &ldquo;{story.nodes[pendingDeleteNodeId].title}&rdquo; and unlink its edges?
            </span>
            <div className="builder-confirm-bar__actions">
              <button
                type="button"
                className="btn-danger"
                onClick={() => performDeleteNode(pendingDeleteNodeId)}
              >
                Confirm delete
              </button>
              <button type="button" onClick={() => setPendingDeleteNodeId(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}

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
          <StorySettingsPanel
            story={story}
            onUpdateStory={(next) => commitStory(next, { coalesceKey: 'settings-edit' })}
          />
        ) : sideTab === 'items' ? (
          <ItemsPanel
            story={story}
            initialItemId={selectedItemId}
            onUpdateStory={(next) => commitStory(next, { coalesceKey: 'items-edit' })}
          />
        ) : selectedNode ? (
          <>
            <div className="inspector-node-actions">
              {rfInstance && (
                <button
                  type="button"
                  onClick={() => focusNode(selectedNode.id)}
                >
                  Center on canvas
                </button>
              )}
              {onPlayFromHere && (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => setPlayFromHereOpen(true)}
                >
                  Play from here
                </button>
              )}
            </div>
            {playFromHereOpen && onPlayFromHere && (
              <PlayFromHereModal
                story={story}
                node={selectedNode}
                onClose={() => setPlayFromHereOpen(false)}
                onStart={(pt) => {
                  setPlayFromHereOpen(false);
                  onPlayFromHere(pt, selectedNode.id);
                }}
              />
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
                  commitStory(next, { coalesceKey: `encounter-edit-${selectedNode.id}` });
                }}
              />
            ) : (
              <PassageInspector
                key={selectedNode.id}
                node={selectedNode}
                story={story}
                onUpdate={(nextPassage) => {
                  commitStory(
                    {
                      ...story,
                      nodes: { ...story.nodes, [selectedNode.id]: nextPassage },
                    },
                    { coalesceKey: `passage-edit-${selectedNode.id}` },
                  );
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
