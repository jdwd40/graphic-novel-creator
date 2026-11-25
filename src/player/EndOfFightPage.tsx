import type { Encounter, FightState } from '../combat/types';
import { useImageUrl } from '../story/useImageUrl';
import './CombatScreen.css';

export interface FightOutcomeSummary {
  woundsGained: string[];
  itemsGained: string[];
  itemsLost: string[];
}

export interface EndOfFightPageProps {
  encounter: Encounter;
  fightState: FightState;
  outcomeSummary?: FightOutcomeSummary;
  onContinue: () => void;
}

function ResolvedPanelImage({
  src,
  alt,
  cropIndex,
}: {
  src: string;
  alt: string;
  cropIndex: number;
}) {
  const resolved = useImageUrl(src);
  return (
    <img
      src={resolved}
      alt={alt}
      className={`combat-art-img combat-art-img--crop-${cropIndex}`}
      data-crop={String(cropIndex)}
    />
  );
}

function formatOutcomeHeading(encounter: Encounter, fightState: FightState): string {
  const key = fightState.exitKey ?? 'victory';
  const customLabel = encounter.exits[key]?.label;
  if (customLabel) return customLabel;
  return key.charAt(0).toUpperCase() + key.slice(1);
}

/**
 * Displays the completed fight as a varied comic-book page with dynamic crops,
 * wider hero/finishing panels, inline captions & SFX, and outcome pills.
 */
export function EndOfFightPage({
  encounter,
  fightState,
  outcomeSummary,
  onContinue,
}: EndOfFightPageProps) {
  const outcomeHeading = formatOutcomeHeading(encounter, fightState);
  const exitKey = fightState.exitKey ?? 'victory';
  const woundsGained = outcomeSummary?.woundsGained ?? [];
  const itemsGained = outcomeSummary?.itemsGained ?? [];
  const itemsLost = outcomeSummary?.itemsLost ?? [];
  const hasOutcomes =
    woundsGained.length > 0 || itemsGained.length > 0 || itemsLost.length > 0;

  const imageRepeatCounts = new Map<string, number>();

  return (
    <section
      className="end-of-fight-page"
      aria-label={`${encounter.enemy.name} — ${outcomeHeading}`}
      data-testid="end-of-fight-page"
    >
      <header className={`story-caption-box end-of-fight-header end-of-fight-header--${exitKey}`}>
        <div className="end-of-fight-header__top">
          <span className={`story-node__badge end-of-fight-badge end-of-fight-badge--${exitKey}`}>
            {outcomeHeading}
          </span>
          <h2 className="page-heading-focus" tabIndex={-1} data-page-heading>
            {encounter.enemy.name}
          </h2>
        </div>

        {hasOutcomes && (
          <div className="end-of-fight-outcomes" data-testid="end-of-fight-outcomes">
            {woundsGained.map((wound, i) => (
              <span key={`w-${i}`} className="outcome-pill outcome-pill--wound">
                Wound: {wound}
              </span>
            ))}
            {itemsGained.map((item, i) => (
              <span key={`g-${i}`} className="outcome-pill outcome-pill--gain">
                +{item}
              </span>
            ))}
            {itemsLost.map((item, i) => (
              <span key={`l-${i}`} className="outcome-pill outcome-pill--loss">
                -{item}
              </span>
            ))}
          </div>
        )}
      </header>

      <ol className="end-of-fight-strip" data-testid="end-of-fight-strip">
        {fightState.beatLog.map((entry, idx) => {
          const isWide =
            entry.kind === 'moment' ||
            (entry.kind === 'beat' && entry.move === 'heavy') ||
            idx === fightState.beatLog.length - 1;
          const seenCount = imageRepeatCounts.get(entry.image) ?? 0;
          imageRepeatCounts.set(entry.image, seenCount + 1);
          const cropIndex = seenCount % 4;

          return (
            <li
              key={`strip-${idx}`}
              className={`strip-panel ${isWide ? 'strip-panel--wide' : ''}`}
              data-testid={`strip-panel-${idx}`}
            >
              <div className="strip-panel__frame">
                <ResolvedPanelImage
                  src={entry.image}
                  cropIndex={cropIndex}
                  alt={
                    entry.kind === 'beat'
                      ? `${encounter.enemy.name} — beat ${entry.beatNumber}`
                      : `${encounter.enemy.name} — story moment`
                  }
                />

                {entry.kind === 'beat' && entry.sfxText && (
                  <span className="strip-panel__sfx">{entry.sfxText}</span>
                )}

                <div className="strip-panel__overlay">
                  {entry.kind === 'beat' ? (
                    <>
                      {entry.tellCaption && (
                        <div className="strip-panel__tell">{entry.tellCaption}</div>
                      )}
                      <div className="strip-panel__caption">{entry.resultCaption}</div>
                    </>
                  ) : (
                    <>
                      <div className="strip-panel__caption">{entry.caption}</div>
                      <div className="strip-panel__tell">
                        <strong>Chosen:</strong> {entry.chosenLabel}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <button
        type="button"
        className="story-choice-btn story-choice-btn--primary end-of-fight-continue"
        onClick={onContinue}
      >
        Continue
      </button>
    </section>
  );
}
