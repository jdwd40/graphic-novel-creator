import { useEffect } from 'react';
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
import { ART_PLAYER_PORTRAIT, makeFallbackArt } from '../story/artwork';
import { useImageUrl } from '../story/useImageUrl';
import './CombatScreen.css';

export interface CombatFeedbackState {
  sfxText: string | null;
  sfxVariant: 'heavy-landed' | 'heavy-blocked' | 'open-punished' | 'normal';
  shakePlayer: boolean;
  enemyHit: boolean;
  playerHit: boolean;
  heavyBlocked: boolean;
  openPunished: boolean;
  reducedMotion: boolean;
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
  keyboardBlocked?: boolean;
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
  keyboardBlocked = false,
  onAdvanceBeat,
  onSelectTactic,
  onRetreat,
  onSelectMomentChoice,
}: CombatScreenProps) {
  const tell = nextTell(fightState, encounter);
  const activeMoment = getActiveMoment(fightState, encounter);
  const hasOpenMoment = activeMoment !== null;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (keyboardBlocked || hasOpenMoment || fightState.status !== 'ongoing' || event.repeat) {
        return;
      }
      if (event.key !== ' ' && event.key !== 'Enter') {
        return;
      }
      const isInteractive = (el: EventTarget | null): boolean => {
        if (!(el instanceof Element)) return false;
        const tag = el.tagName;
        if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'A') {
          return true;
        }
        return Boolean(el.closest('button, a, input, textarea, select, [role="button"], [role="dialog"]'));
      };
      if (isInteractive(event.target) || isInteractive(document.activeElement)) {
        return;
      }
      event.preventDefault();
      onAdvanceBeat();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fightState.status, hasOpenMoment, keyboardBlocked, onAdvanceBeat]);
  const availableMomentChoices = activeMoment
    ? getAvailableMomentChoices(fightState, encounter, storyState)
    : [];
  const feedbackArtOverride =
    !artSrc && feedback
      ? feedback.enemyHit && encounter.art?.enemyWounded
        ? encounter.art.enemyWounded
        : feedback.playerHit && encounter.art?.playerWounded
          ? encounter.art.playerWounded
          : feedback.openPunished && encounter.art?.open
            ? encounter.art.open
            : null
      : null;
  const rawImageSource = artSrc ?? feedbackArtOverride ?? selectEncounterArt(encounter, fightState);
  const imageSource =
    useImageUrl(rawImageSource) ?? makeFallbackArt(encounter.enemy.name || 'Unknown foe', 'foe');
  const portraitUrl = useImageUrl(playerPortrait) ?? ART_PLAYER_PORTRAIT;
  const upcomingMoveClass = hasOpenMoment || !tell.showIcon ? '' : `combat-screen--tell-${tell.move}`;

  const stageFeedbackClasses = [
    'combat-art-stage',
    feedback?.shakePlayer ? 'is-shaking' : '',
    feedback?.enemyHit ? 'is-enemy-hit' : '',
    feedback?.heavyBlocked ? 'is-heavy-blocked' : '',
    feedback?.openPunished ? 'is-open-punished' : '',
    feedback?.reducedMotion ? 'is-reduced-motion' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section
      className={`combat-screen ${upcomingMoveClass}`.trim()}
      aria-label={`Combat with ${encounter.enemy.name}`}
      data-testid="combat-screen"
    >
      <h2 className="sr-only page-heading-focus" tabIndex={-1} data-page-heading>
        Combat with {encounter.enemy.name}
      </h2>

      <div className="combat-paired-header" data-testid="combat-paired-header">
        <div
          className={`combat-side combat-side--player ${feedback?.playerHit ? 'is-player-hit' : ''} ${feedback?.reducedMotion ? 'is-reduced-motion' : ''}`.trim()}
          data-testid="combat-player-side"
        >
          <div className="combat-portrait-wrap">
            <img src={portraitUrl} alt="Player portrait" className="combat-portrait-img" />
          </div>
          <div className="combat-side__pips">
            <div className="combat-side__name" aria-hidden="true">You</div>
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

        <span className="combat-vs" aria-hidden="true">VS</span>

        <div
          className={`combat-side combat-side--enemy ${feedback?.enemyHit ? 'is-enemy-hit' : ''} ${feedback?.reducedMotion ? 'is-reduced-motion' : ''}`.trim()}
          data-testid="combat-enemy-side"
        >
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
          className={stageFeedbackClasses}
          data-testid="combat-art-stage"
        >
          <img
            src={imageSource}
            alt={encounter.enemy.name}
            className="combat-art-img"
          />

          <span className="art-fx" aria-hidden="true" />
          {feedback && <span className="combat-impact-flash" aria-hidden="true" />}

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

        <div
          className={`story-caption-box combat-caption ${hasOpenMoment ? 'combat-caption--moment' : ''}`.trim()}
          data-testid="combat-result-caption"
        >
          {activeMoment ? activeMoment.moment.caption : resultCaption}
        </div>
      </div>

      <div className="combat-dock" data-testid="combat-dock">
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
          <TacticBar
            currentTactic={fightState.currentTactic}
            allowRetreat={encounter.allowRetreat}
            onSelectTactic={onSelectTactic}
            onRetreat={onRetreat}
          />
        )}

        <div className="combat-advance-area">
          <button
            type="button"
            className="combat-next-btn"
            data-testid="combat-next-btn"
            disabled={hasOpenMoment || fightState.status !== 'ongoing'}
            onClick={onAdvanceBeat}
          >
            Next beat
          </button>

          {!hasOpenMoment && fightState.beatNumber < 3 && (
            <p className="combat-tap-hint" data-testid="combat-tap-hint">
              Tap panel or caption to advance one beat
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
