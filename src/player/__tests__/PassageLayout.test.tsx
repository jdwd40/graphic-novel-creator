import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import indexHtml from '../../../index.html?raw';
import mainTsx from '../../main.tsx?raw';
import themeCss from '../../theme.css?raw';
import { createSeedStory } from '../../story/seed';
import type { PassageNode, Story } from '../../story/types';
import { StoryPlayer } from '../StoryPlayer';

describe('Full-bleed passage layout and comic theme (#48)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('uses bundled fonts and CSS theme variables with zero external font links', () => {
    expect(indexHtml).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com|https?:\/\//i);
    expect(themeCss).not.toMatch(/https?:\/\//i);
    expect(mainTsx).toContain('@fontsource/bangers');
    expect(mainTsx).toContain('@fontsource/atkinson-hyperlegible');
    expect(themeCss).toContain('--font-display:');
    expect(themeCss).toContain('--font-body:');
    expect(themeCss).toContain('--color-paper:');
    expect(themeCss).toContain('--border-panel:');
  });

  it('renders full-bleed passage layout across phone, tablet, and desktop widths, and intentional banner when image is missing', () => {
    const story = createSeedStory();
    for (const width of [360, 390, 768, 1280]) {
      Object.defineProperty(window, 'innerWidth', { value: width, configurable: true });
      const { unmount } = render(<StoryPlayer story={story} showTitleScreen={false} />);
      expect(screen.getByTestId('passage-art-stage')).toBeInTheDocument();
      expect(screen.getByTestId('passage-caption-panel')).toBeInTheDocument();
      unmount();
    }

    const intro = story.nodes.passage_intro as PassageNode;
    const noArtStory: Story = {
      ...story,
      nodes: {
        ...story.nodes,
        passage_intro: { ...intro, image: undefined },
      },
    };
    render(<StoryPlayer story={noArtStory} showTitleScreen={false} />);
    expect(screen.queryByTestId('passage-art-stage')).not.toBeInTheDocument();
    expect(screen.getByTestId('passage-no-art-banner')).toHaveTextContent('The Courtyard Gate');
  });
});
