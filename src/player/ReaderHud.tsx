import { useState } from 'react';
import { HealthPips } from './HealthPips';

export interface ReaderHudProps {
  health: number;
  maxHealth: number;
  armour: number;
  maxArmour: number;
  satchelOpen: boolean;
  autoAdvance: boolean;
  onToggleSatchel: () => void;
  onToggleAutoAdvance: (checked: boolean) => void;
  onRestart: () => void;
  onOpenBattleGuide?: () => void;
  onExitToBuilder?: () => void;
}

export function ReaderHud({
  health,
  maxHealth,
  armour,
  maxArmour,
  satchelOpen,
  autoAdvance,
  onToggleSatchel,
  onToggleAutoAdvance,
  onRestart,
  onOpenBattleGuide,
  onExitToBuilder,
}: ReaderHudProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);

  return (
    <div className="reader-hud-wrap" data-testid="reader-hud">
      <div className="reader-hud" role="region" aria-label="Reader status">
        <div className="reader-hud__pips">
          <HealthPips
            label="Reader health"
            variant="player"
            current={health}
            max={maxHealth}
            buffer={armour}
            maxBuffer={maxArmour}
          />
        </div>

        <div className="reader-hud__actions">
          <button
            type="button"
            className="reader-hud__btn"
            aria-expanded={satchelOpen}
            aria-label={satchelOpen ? 'Close satchel' : 'Open satchel'}
            onClick={onToggleSatchel}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M8 8V6a4 4 0 0 1 8 0v2M5 8h14l1.2 10.2A2.5 2.5 0 0 1 17.7 21H6.3a2.5 2.5 0 0 1-2.5-2.8L5 8Zm4 5h6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>Satchel</span>
          </button>

          <button
            type="button"
            className="reader-hud__btn"
            aria-expanded={menuOpen}
            aria-label="Reader menu"
            onClick={() => {
              setMenuOpen((v) => !v);
              setConfirmRestart(false);
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
            </svg>
            <span>Menu</span>
          </button>

          {onExitToBuilder && (
            <button
              type="button"
              className="reader-hud__btn reader-hud__btn--subtle"
              aria-label="Exit to builder"
              onClick={onExitToBuilder}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 8l-4 4 4 4M6 12h10"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="sr-only">Exit</span>
            </button>
          )}
        </div>
      </div>

      {menuOpen && (
        <div className="reader-menu-popover" role="dialog" aria-label="Reader options">
          <label className="reader-menu__row">
            <input
              type="checkbox"
              checked={autoAdvance}
              onChange={(e) => onToggleAutoAdvance(e.target.checked)}
            />
            <span>Auto-advance beats</span>
          </label>

          {onOpenBattleGuide && (
            <button
              type="button"
              className="reader-menu__btn"
              onClick={() => {
                setMenuOpen(false);
                onOpenBattleGuide();
              }}
            >
              How combat works
            </button>
          )}

          {!confirmRestart ? (
            <button
              type="button"
              className="reader-menu__btn"
              onClick={() => setConfirmRestart(true)}
            >
              Restart story
            </button>
          ) : (
            <div className="reader-menu__confirm" role="alertdialog" aria-label="Confirm restart">
              <span>Restart from the beginning?</span>
              <div className="reader-menu__confirm-actions">
                <button
                  type="button"
                  className="reader-menu__btn reader-menu__btn--danger"
                  onClick={() => {
                    setConfirmRestart(false);
                    setMenuOpen(false);
                    onRestart();
                  }}
                >
                  Confirm restart
                </button>
                <button
                  type="button"
                  className="reader-menu__btn"
                  onClick={() => setConfirmRestart(false)}
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
              onClick={() => {
                setMenuOpen(false);
                onExitToBuilder();
              }}
            >
              Exit to builder
            </button>
          )}
        </div>
      )}
    </div>
  );
}
