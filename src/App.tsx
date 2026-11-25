import { useCallback, useState } from 'react';
import { StoryMapBuilder } from './builder/StoryMapBuilder';
import { StoryLibrary } from './library/StoryLibrary';
import { StoryPlayer } from './player/StoryPlayer';
import {
  createBlankStory,
  deleteStory,
  duplicateStory,
  listStories,
  openDemoStory,
  renameStory,
} from './story/store';
import type { Story } from './story/types';

export function App() {
  const [stories, setStories] = useState<Story[]>(() => {
    const existing = listStories();
    if (existing.length > 0) return existing;
    const demo = openDemoStory();
    return [demo];
  });
  const [activeStoryId, setActiveStoryId] = useState<string>(() => stories[0]?.id ?? 'iron-bell');
  const [mode, setMode] = useState<'library' | 'builder' | 'player'>('library');

  const refreshStories = useCallback(() => {
    setStories(listStories());
  }, []);

  const activeStory =
    stories.find((s) => s.id === activeStoryId) ?? stories[0] ?? null;

  const handleCreateBlank = (title?: string) => {
    const created = createBlankStory(title);
    refreshStories();
    setActiveStoryId(created.id);
    setMode('builder');
  };

  const handleOpenDemo = () => {
    const demo = openDemoStory();
    refreshStories();
    setActiveStoryId(demo.id);
    setMode('builder');
  };

  const handleStoryChange = (nextStory: Story) => {
    setStories((prev) => {
      const exists = prev.some((s) => s.id === nextStory.id);
      if (!exists) return [nextStory, ...prev];
      return prev.map((s) => (s.id === nextStory.id ? nextStory : s));
    });
  };

  const handleRename = (storyId: string, nextTitle: string) => {
    renameStory(storyId, nextTitle);
    refreshStories();
  };

  const handleDuplicate = (storyId: string) => {
    const copy = duplicateStory(storyId);
    refreshStories();
    if (copy) {
      setActiveStoryId(copy.id);
    }
  };

  const handleDelete = async (storyId: string) => {
    await deleteStory(storyId);
    const remaining = listStories();
    setStories(remaining);
    if (activeStoryId === storyId) {
      setActiveStoryId(remaining[0]?.id ?? '');
      if (mode !== 'library') {
        setMode('library');
      }
    }
  };

  const handleImported = (imported: Story) => {
    refreshStories();
    setActiveStoryId(imported.id);
    setMode('builder');
  };

  return (
    <div className="app-shell">
      {mode !== 'player' && (
        <header className="app-header">
          <h1 className="app-title">Graphic Novel Creator</h1>
          <nav className="app-nav" aria-label="Workspace mode">
            <button
              type="button"
              className={mode === 'library' ? 'is-active' : ''}
              onClick={() => {
                refreshStories();
                setMode('library');
              }}
            >
              Stories
            </button>
            {activeStory && (
              <>
                <button
                  type="button"
                  className={mode === 'builder' ? 'is-active' : ''}
                  onClick={() => setMode('builder')}
                >
                  Story Builder
                </button>
                <button
                  type="button"
                  onClick={() => setMode('player')}
                >
                  Play Story
                </button>
              </>
            )}
          </nav>
        </header>
      )}
      <main className="app-main" style={{ padding: 0 }}>
        {mode === 'library' ? (
          <StoryLibrary
            stories={stories}
            onCreateBlank={handleCreateBlank}
            onOpenDemo={handleOpenDemo}
            onOpenBuilder={(id) => {
              setActiveStoryId(id);
              setMode('builder');
            }}
            onOpenPlayer={(id) => {
              setActiveStoryId(id);
              setMode('player');
            }}
            onRename={handleRename}
            onDuplicate={handleDuplicate}
            onDelete={handleDelete}
            onImported={handleImported}
          />
        ) : mode === 'builder' && activeStory ? (
          <StoryMapBuilder
            key={activeStory.id}
            story={activeStory}
            onStoryChange={handleStoryChange}
          />
        ) : activeStory ? (
          <StoryPlayer
            key={activeStory.id}
            story={activeStory}
            onExitToBuilder={() => setMode('builder')}
          />
        ) : (
          <StoryLibrary
            stories={stories}
            onCreateBlank={handleCreateBlank}
            onOpenDemo={handleOpenDemo}
            onOpenBuilder={(id) => {
              setActiveStoryId(id);
              setMode('builder');
            }}
            onOpenPlayer={(id) => {
              setActiveStoryId(id);
              setMode('player');
            }}
            onRename={handleRename}
            onDuplicate={handleDuplicate}
            onDelete={handleDelete}
            onImported={handleImported}
          />
        )}
      </main>
    </div>
  );
}

export default App;
