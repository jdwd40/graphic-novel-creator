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
            Satchel
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
            Menu
          </button>

          {onExitToBuilder && (
            <button
              type="button"
              className="reader-hud__btn reader-hud__btn--subtle"
              aria-label="Exit to builder"
              onClick={onExitToBuilder}
            >
              Exit
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
