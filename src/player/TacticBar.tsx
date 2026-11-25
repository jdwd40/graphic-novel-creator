import type { Tactic } from '../combat/types';

export interface TacticBarProps {
  currentTactic: Tactic;
  allowRetreat: boolean;
  onSelectTactic: (tactic: Tactic) => void;
  onRetreat: () => void;
}

const TACTIC_ITEMS: ReadonlyArray<{
  value: Tactic;
  label: string;
  hint: string;
}> = [
  { value: 'press', label: 'Press', hint: 'hit hard, risky' },
  { value: 'steady', label: 'Steady', hint: 'even trade' },
  { value: 'guard', label: 'Guard', hint: 'block the heavy blow' },
];

function TacticIcon({ tactic }: { tactic: Tactic }) {
  if (tactic === 'press') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M13 2L4 14h7l-1 8 10-12h-7l0-8z"
          fill="currentColor"
        />
      </svg>
    );
  }
  if (tactic === 'guard') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 2L4 5v6.2c0 5.1 3.4 9.6 8 10.8 4.6-1.2 8-5.7 8-10.8V5l-8-3z"
          fill="currentColor"
        />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="2.5" fill="none" />
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

/**
 * Combat tactic bar with icons, short decision hints, non-colour active indicator,
 * and a visually separated Retreat button when retreat is enabled.
 */
export function TacticBar({
  currentTactic,
  allowRetreat,
  onSelectTactic,
  onRetreat,
}: TacticBarProps) {
  return (
    <div className="combat-tactic-bar" role="group" aria-label="Combat tactics">
      <div className="combat-tactic-options">
        {TACTIC_ITEMS.map((opt) => {
          const selected = currentTactic === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              className={`tactic-btn ${selected ? 'is-selected' : ''}`}
              aria-label={opt.label}
              aria-pressed={selected}
              onClick={() => onSelectTactic(opt.value)}
            >
              <span className="tactic-btn__top">
                <TacticIcon tactic={opt.value} />
                <span className="tactic-btn__label">{opt.label}</span>
                {selected && (
                  <span className="tactic-btn__check" aria-hidden="true">
                    ✓
                  </span>
                )}
              </span>
              <span className="tactic-btn__hint">{opt.hint}</span>
            </button>
          );
        })}
      </div>

      {allowRetreat && (
        <div className="combat-retreat-slot">
          <button type="button" className="retreat-btn" onClick={onRetreat}>
            Retreat
          </button>
        </div>
      )}
    </div>
  );
}
