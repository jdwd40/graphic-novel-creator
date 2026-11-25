import { selectEncounterArt } from '../combat/art';
import { nextTell } from '../combat/captions';
import { EMPTY_STORY_STATE } from '../combat/conditions';
import { getActiveMoment, getAvailableMomentChoices } from '../combat/resolver';
import type {
  Encounter,
  FightState,
  StoryStateSnapshot,
  Tactic,
} from '../combat/types';
import { ChoiceList } from './ChoiceList';
import { HealthPips } from './HealthPips';
import { TacticBar } from './TacticBar';
import { TellBanner } from './TellBanner';
import { useImageUrl } from '../story/useImageUrl';
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
  storyState?: StoryStateSnapshot;
  playerPortrait?: string;
  resultCaption: string;
  artSrc?: string;
  feedback?: CombatFeedbackState;
  onAdvanceBeat: () => void;
  onSelectTactic: (tactic: Tactic) => void;
  onRetreat: () => void;
  onSelectMomentChoice?: (choiceIndex: number) => void;
}

export function CombatScreen({
  encounter,
  fightState,
  storyState = EMPTY_STORY_STATE,
  playerPortrait,
  resultCaption,
  artSrc,
  feedback,
  onAdvanceBeat,
  onSelectTactic,
  onRetreat,
  onSelectMomentChoice,
}: CombatScreenProps) {
  const tell = nextTell(fightState, encounter);
  const activeMoment = getActiveMoment(fightState, encounter);
  const hasOpenMoment = activeMoment !== null;
  const availableMomentChoices = activeMoment
    ? getAvailableMomentChoices(fightState, encounter, storyState)
    : [];
  const rawImageSource = artSrc ?? selectEncounterArt(encounter, fightState);
  const imageSource = useImageUrl(rawImageSource);
  const portraitUrl = useImageUrl(playerPortrait);

  return (
    <section
      className="combat-screen"
      aria-label={`Combat with ${encounter.enemy.name}`}
      data-testid="combat-screen"
    >
      <h2 className="sr-only page-heading-focus" tabIndex={-1} data-page-heading>
        Combat with {encounter.enemy.name}
      </h2>

      <div className="combat-paired-header" data-testid="combat-paired-header">
        <div
          className={`combat-side combat-side--player ${feedback?.shakePlayer ? 'is-player-hit' : ''}`}
          data-testid="combat-player-side"
        >
          <div className="combat-portrait-wrap">
            {portraitUrl ? (
              <img
                src={portraitUrl}
                alt="Player portrait"
                className="combat-portrait-img"
              />
            ) : (
              <div className="combat-portrait-fallback" aria-label="Player portrait">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M5 20c0-3.5 3.1-6 7-6s7 2.5 7 6" />
                </svg>
              </div>
            )}
          </div>
          <div className="combat-side__pips">
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
          </div>
        </div>

        <div className="combat-side combat-side--enemy" data-testid="combat-enemy-side">
          <div className="combat-side__enemy-name">{encounter.enemy.name}</div>
          <div className="combat-side__pips">
            <HealthPips
              label="Enemy health"
              variant="enemy"
              current={fightState.enemyHealth}
              max={fightState.enemyMaxHealth}
              lostCount={feedback?.enemyLostPips}
            />
          </div>
        </div>
      </div>

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

          {feedback?.sfxText && (
            <span
              className={`combat-sfx-badge combat-sfx-badge--${feedback.sfxVariant}`}
              data-testid="combat-sfx"
            >
              {feedback.sfxText}
            </span>
          )}

          {!hasOpenMoment && (
            <TellBanner caption={tell.caption} move={tell.move} showIcon={tell.showIcon} />
          )}
        </div>

        <div className="story-caption-box" data-testid="combat-result-caption">
          {activeMoment ? activeMoment.moment.caption : resultCaption}
        </div>
      </div>

      {hasOpenMoment ? (
        <div data-testid="moment-choices-panel">
          <ChoiceList
            ariaLabel="Moment choices"
            choices={availableMomentChoices.map((c) => ({
              id: String(c.choiceIndex),
              label: c.choice.label,
            }))}
            onSelect={(id) => onSelectMomentChoice?.(Number(id))}
          />
        </div>
      ) : (
        <>
          <TacticBar
            currentTactic={fightState.currentTactic}
            allowRetreat={encounter.allowRetreat}
            onSelectTactic={onSelectTactic}
            onRetreat={onRetreat}
          />

          <p className="combat-tap-hint">Tap panel or caption to advance one beat</p>
        </>
      )}
    </section>
  );
}
