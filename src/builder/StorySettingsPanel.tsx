import type { Story } from '../story/types';
import { ImagePicker } from './ImagePicker';

export interface StorySettingsPanelProps {
  story: Story;
  onUpdateStory: (nextStory: Story) => void;
}

export function StorySettingsPanel({ story, onUpdateStory }: StorySettingsPanelProps) {
  return (
    <section
      className="inspector-form"
      aria-label="Story settings"
      data-testid="story-settings-panel"
    >
      <h3>Story Settings</h3>
      <p className="inspector-sublabel">
        Configure the cover art, title, and short blurb shown on the reader&apos;s title screen.
      </p>

      <div className="inspector-field">
        <label htmlFor="story-settings-title">Story title</label>
        <input
          id="story-settings-title"
          type="text"
          value={story.title}
          onChange={(e) => onUpdateStory({ ...story, title: e.target.value })}
        />
      </div>

      <div className="inspector-field">
        <label htmlFor="story-settings-blurb">Story blurb</label>
        <textarea
          id="story-settings-blurb"
          rows={3}
          style={{ resize: 'vertical' }}
          value={story.blurb ?? ''}
          onChange={(e) => onUpdateStory({ ...story, blurb: e.target.value })}
        />
      </div>

      <ImagePicker
        label="Cover image"
        value={story.coverImage}
        story={story}
        onChange={(coverImage) => onUpdateStory({ ...story, coverImage })}
        testId="story-cover-image-picker"
      />

      <ImagePicker
        label="Player portrait"
        value={story.playerPortrait}
        story={story}
        onChange={(playerPortrait) => onUpdateStory({ ...story, playerPortrait })}
        testId="story-player-portrait-picker"
      />
    </section>
  );
}
