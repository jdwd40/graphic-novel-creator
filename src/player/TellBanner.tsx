import type { Move } from '../combat/types';

export interface TellBannerProps {
  caption: string | null;
  move: Move;
  showIcon: boolean;
}

function TellIntentIcon({ move }: { move: Move }) {
  const title =
    move === 'heavy' ? 'Heavy windup' : move === 'open' ? 'Enemy open' : 'Quick strike';
  return (
    <span
      className={`tell-banner__icon tell-banner__icon--${move}`}
      title={title}
      aria-label={`Intent: ${title}`}
      data-testid="tell-intent-icon"
    >
      {move === 'heavy' && (
        <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 2L15 9.5L22 10L16.5 14.5L18.5 22L12 17.5L5.5 22L7.5 14.5L2 10L9 9.5L12 2Z"
            fill="currentColor"
          />
        </svg>
      )}
      {move === 'strike' && (
        <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M4 20L19 5M13 4H20V11"
            stroke="currentColor"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      )}
      {move === 'open' && (
        <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="7.5" stroke="currentColor" strokeWidth="2.8" fill="none" />
          <path d="M9 12H15" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      )}
    </span>
  );
}

/**
 * Renders the upcoming enemy tell along the bottom edge of the combat panel.
 * Vague tells intentionally omit icons and move-specific styling so they cannot leak intent.
 */
export function TellBanner({ caption, move, showIcon }: TellBannerProps) {
  if (!caption) return null;

  const variantClass = showIcon ? `combat-tell-banner--${move}` : 'combat-tell-banner--vague';

  return (
    <div
      className={`combat-tell-banner ${variantClass}`}
      data-testid="combat-tell-caption"
    >
      {showIcon && <TellIntentIcon move={move} />}
      <span className="tell-banner__text">{caption}</span>
    </div>
  );
}
