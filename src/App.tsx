import { useState } from 'react';
import { StoryMapBuilder } from './builder/StoryMapBuilder';
import { createSeedStory } from './story/seed';
import { loadStory, saveStory } from './story/store';
import type { Story } from './story/types';

export function App() {
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
        <span className="app-subtitle">{story.title}</span>
      </header>
      <main className="app-main" style={{ padding: 0 }}>
        <StoryMapBuilder
          story={story}
          onStoryChange={setStory}
          onResetSeed={handleResetSeed}
        />
      </main>
    </div>
  );
}

export default App;
