import { useState } from 'react';
import type { Story } from '../story/types';
import { useImageUrl } from '../story/useImageUrl';

export interface TitleScreenProps {
  story: Story;
  hasSave: boolean;
  onContinue: () => void;
  onNewGame: () => void;
  onExitToBuilder?: () => void;
}

export function TitleScreen({
  story,
  hasSave,
  onContinue,
  onNewGame,
  onExitToBuilder,
}: TitleScreenProps) {
  const coverUrl = useImageUrl(story.coverImage);
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);

  return (
    <section className="title-screen" aria-label={story.title} data-testid="title-screen">
      {coverUrl ? (
        <div className="title-screen__cover-wrap">
          <img
            src={coverUrl}
            alt={`${story.title} cover art`}
            className="title-screen__cover-img"
            data-testid="title-cover-img"
          />
          <div className="title-screen__title-overlay">
            <h1 className="title-screen__heading">{story.title}</h1>
          </div>
        </div>
      ) : (
        <div className="title-screen__typo-cover" data-testid="title-typographic-cover">
          <span className="title-screen__eyebrow">Interactive Graphic Novel</span>
          <h1 className="title-screen__heading">{story.title}</h1>
        </div>
      )}

      {story.blurb && <p className="title-screen__blurb">{story.blurb}</p>}

      <div className="title-screen__actions">
        {hasSave && (
          <button
            type="button"
            className="story-choice-btn title-screen__continue-btn"
            onClick={onContinue}
          >
            Continue
          </button>
        )}

        {!confirmOverwrite ? (
          <button
            type="button"
            className="story-choice-btn"
            onClick={() => {
              if (hasSave) {
                setConfirmOverwrite(true);
              } else {
                onNewGame();
              }
            }}
          >
            New game
          </button>
        ) : (
          <div
            className="reader-menu__confirm"
            role="alertdialog"
            aria-label="Confirm new game"
          >
            <span>Start a new game? Your saved progress will be overwritten.</span>
            <div className="reader-menu__confirm-actions">
              <button
                type="button"
                className="reader-menu__btn reader-menu__btn--danger"
                onClick={() => {
                  setConfirmOverwrite(false);
                  onNewGame();
                }}
              >
                Confirm new game
              </button>
              <button
                type="button"
                className="reader-menu__btn"
                onClick={() => setConfirmOverwrite(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {onExitToBuilder && (
          <button
            type="button"
            className="reader-menu__btn"
            onClick={onExitToBuilder}
          >
            Exit to builder
          </button>
        )}
      </div>
    </section>
  );
}
