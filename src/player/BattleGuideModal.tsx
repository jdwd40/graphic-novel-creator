import { useEffect } from 'react';

export interface BattleGuideModalProps {
  onClose: () => void;
}

/**
 * Plain-language combat reference dialog auto-shown once per playthrough and reopened from Reader Menu.
 */
export function BattleGuideModal({ onClose }: BattleGuideModalProps) {
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      className="battle-guide-backdrop"
      data-testid="battle-guide-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="battle-guide-modal"
        role="dialog"
        aria-modal="true"
        aria-label="How combat works"
        data-testid="battle-guide-modal"
      >
        <div className="battle-guide-modal__header">
          <h3>How combat works</h3>
          <button
            type="button"
            className="satchel-sheet__close"
            onClick={onClose}
            aria-label="Close battle guide"
          >
            Close
          </button>
        </div>

        <ul className="battle-guide-list">
          <li>
            <strong>Read the tell:</strong> the banner at the bottom of the panel warns what the
            enemy will do on the next beat.
          </li>
          <li>
            <strong>Press</strong> (hit hard, risky): strikes with extra force, best when the enemy
            is Open — leaves you exposed against attacks.
          </li>
          <li>
            <strong>Steady</strong> (even trade): balanced exchange against quick strikes.
          </li>
          <li>
            <strong>Guard</strong> (block the heavy blow): braces behind your armour to blunt heavy
            windups without breaking stride.
          </li>
          <li>
            <strong>Shields &amp; hearts:</strong> armour shields absorb blows first and mend after
            the fight; lost hearts stay lost until you rest or heal.
          </li>
          <li>
            <strong>Retreat:</strong> when available, lets you break away at the cost of one final
            parting blow.
          </li>
        </ul>

        <button type="button" className="story-choice-btn battle-guide-done" onClick={onClose}>
          Got it
        </button>
      </div>
    </div>
  );
}
