import type { StoryNotificationCard } from '../story/playthrough';
import { useImageUrl } from '../story/useImageUrl';

export interface NotificationCardProps {
  cards: readonly StoryNotificationCard[];
  onDismiss: () => void;
}

export function NotificationCard({ cards, onDismiss }: NotificationCardProps) {
  const current = cards[0];
  const imgUrl = useImageUrl(current?.image);

  if (!current) return null;

  return (
    <button
      type="button"
      className={`story-notice-card story-notice-card--${current.kind}`}
      role="status"
      data-testid="player-notifications"
      aria-label={`${current.title}. Tap to dismiss`}
      onClick={onDismiss}
    >
      {imgUrl && (
        <img
          src={imgUrl}
          alt={current.title}
          className="story-notice-card__img"
        />
      )}
      <div className="story-notice-card__body">
        <strong>{current.title}</strong>
        {current.subtitle && (
          <span className="story-notice-card__sub">{current.subtitle}</span>
        )}
        <span className="story-notice-card__hint">
          {cards.length > 1 ? `Tap to continue (${cards.length - 1} more)` : 'Tap to dismiss'}
        </span>
      </div>
    </button>
  );
}
