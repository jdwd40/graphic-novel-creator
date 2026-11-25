import { useState } from 'react';
import { StoryMapBuilder } from './builder/StoryMapBuilder';
import { StoryPlayer } from './player/StoryPlayer';
import { createSeedStory } from './story/seed';
import { loadStory, saveStory } from './story/store';
import type { Story } from './story/types';

export function App() {
  const [mode, setMode] = useState<'builder' | 'player'>('builder');
  const [story, setStory] = useState<Story>(() => {
    const existing = loadStory('iron-bell');
    if (existing) return existing;
    const seeded = createSeedStory();
    saveStory(seeded);
    return seeded;
  });

  const handleResetSeed = () => {
    const seeded = createSeedStory();
    saveStory(seeded);
    setStory(seeded);
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1 className="app-title">Graphic Novel Creator</h1>
        <nav className="app-nav" aria-label="Workspace mode">
          <button
            type="button"
            className={mode === 'builder' ? 'is-active' : ''}
            onClick={() => setMode('builder')}
          >
            Story Builder
          </button>
          <button
            type="button"
            className={mode === 'player' ? 'is-active' : ''}
            onClick={() => setMode('player')}
          >
            Play Story
          </button>
        </nav>
      </header>
      <main className="app-main" style={{ padding: 0 }}>
        {mode === 'builder' ? (
          <StoryMapBuilder
            story={story}
            onStoryChange={setStory}
            onResetSeed={handleResetSeed}
          />
        ) : (
          <StoryPlayer story={story} />
        )}
      </main>
    </div>
  );
}

export default App;
