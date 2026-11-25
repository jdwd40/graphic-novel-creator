import { nextTell } from '../combat/captions';
import type { Encounter, FightState, Move, Tactic } from '../combat/types';
import { HealthPips } from './HealthPips';
import './CombatScreen.css';

export interface CombatFeedbackState {
  sfxText: string | null;
  sfxVariant: 'heavy-landed' | 'heavy-blocked' | 'normal';
  shakePlayer: boolean;
  enemyLostPips: number;
  playerLostPips: number;
  bufferLostPips: number;
}

export interface CombatScreenProps {
  encounter: Encounter;
  fightState: FightState;
  resultCaption: string;
  artSrc?: string;
  feedback?: CombatFeedbackState;
  onAdvanceBeat: () => void;
  onSelectTactic: (tactic: Tactic) => void;
  onRetreat: () => void;
}

function IntentIcon({ move }: { move: Move }) {
  const title =
    move === 'heavy' ? 'Heavy windup' : move === 'open' ? 'Enemy open' : 'Quick strike';
  return (
    <span className="combat-intent-badge" title={title} aria-label={`Intent: ${title}`}>
      {move === 'heavy' && (
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 2L15 10H22L16 15L18 22L12 18L6 22L8 15L2 10H9L12 2Z" fill="currentColor" />
        </svg>
      )}
      {move === 'strike' && (
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 20L19 5M14 4H20V10" stroke="currentColor" strokeWidth="2.5" fill="none" />
        </svg>
      )}
      {move === 'open' && (
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="2.5" fill="none" />
        </svg>
      )}
    </span>
  );
}

const TACTIC_OPTIONS: ReadonlyArray<{ value: Tactic; label: string }> = [
  { value: 'press', label: 'Press' },
  { value: 'steady', label: 'Steady' },
  { value: 'guard', label: 'Guard' },
];

export function CombatScreen({
  encounter,
  fightState,
  resultCaption,
  artSrc,
  feedback,
  onAdvanceBeat,
  onSelectTactic,
  onRetreat,
}: CombatScreenProps) {
  const tell = nextTell(fightState, encounter);
  const hasOpenMoment = fightState.pendingMomentQueue.length > 0;
  const imageSource = artSrc ?? encounter.enemy.image;

  return (
    <section
      className="combat-screen"
      aria-label={`Combat with ${encounter.enemy.name}`}
      data-testid="combat-screen"
    >
      <div
        className={`combat-tap-zone ${hasOpenMoment ? 'combat-tap-zone--locked' : ''}`}
        data-testid="combat-tap-zone"
        onClick={() => {
          if (!hasOpenMoment && fightState.status === 'ongoing') {
            onAdvanceBeat();
          }
        }}
      >
        <div
          className={`combat-art-stage ${feedback?.shakePlayer ? 'is-shaking' : ''}`}
          data-testid="combat-art-stage"
        >
          <img
            src={imageSource}
            alt={encounter.enemy.name}
            className="combat-art-img"
          />

          <div className="combat-hud-overlay">
            <div className="combat-hud-row">
              <HealthPips
                label="Health"
                variant="player"
                current={fightState.playerHealth}
                max={fightState.playerMaxHealth}
                buffer={fightState.playerBuffer}
                maxBuffer={fightState.playerMaxBuffer}
                lostCount={feedback?.playerLostPips}
                bufferLostCount={feedback?.bufferLostPips}
              />
              <HealthPips
                label="Enemy health"
                variant="enemy"
                current={fightState.enemyHealth}
                max={fightState.enemyMaxHealth}
                lostCount={feedback?.enemyLostPips}
              />
            </div>
          </div>

          {tell.showIcon && <IntentIcon move={tell.move} />}

          {feedback?.sfxText && (
            <span
              className={`combat-sfx-badge combat-sfx-badge--${feedback.sfxVariant}`}
              data-testid="combat-sfx"
            >
              {feedback.sfxText}
            </span>
          )}
        </div>

        <div className="story-caption-box" data-testid="combat-result-caption">
          {resultCaption}
        </div>

        {tell.caption && (
          <div className="combat-tell-box" data-testid="combat-tell-caption">
            {tell.caption}
          </div>
        )}
      </div>

      <div className="combat-tactic-bar" role="group" aria-label="Combat tactics">
        {TACTIC_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className="tactic-btn"
            aria-pressed={fightState.currentTactic === opt.value}
            onClick={() => onSelectTactic(opt.value)}
          >
            {opt.label}
          </button>
        ))}
        {encounter.allowRetreat && (
          <button type="button" className="retreat-btn" onClick={onRetreat}>
            Retreat
          </button>
        )}
      </div>

      <p className="combat-tap-hint">Tap panel or caption to advance one beat</p>
    </section>
  );
}
