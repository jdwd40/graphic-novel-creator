import type { Encounter, FightState } from '../combat/types';
import { useImageUrl } from '../story/useImageUrl';
import './CombatScreen.css';

export interface EndOfFightPageProps {
  encounter: Encounter;
  fightState: FightState;
  onContinue: () => void;
}

function ResolvedPanelImage({ src, alt }: { src: string; alt: string }) {
  const resolved = useImageUrl(src);
  return <img src={resolved} alt={alt} className="combat-art-img" />;
}

function formatOutcomeHeading(encounter: Encounter, fightState: FightState): string {
  const key = fightState.exitKey ?? 'victory';
  const customLabel = encounter.exits[key]?.label;
  if (customLabel) return customLabel;
  return key.charAt(0).toUpperCase() + key.slice(1);
}

export function EndOfFightPage({
  encounter,
  fightState,
  onContinue,
}: EndOfFightPageProps) {
  const outcomeHeading = formatOutcomeHeading(encounter, fightState);

  return (
    <section
      className="end-of-fight-page"
      aria-label={`${encounter.enemy.name} — ${outcomeHeading}`}
      data-testid="end-of-fight-page"
    >
      <header className="story-caption-box end-of-fight-header">
        <span className="story-node__badge">{outcomeHeading}</span>
        <h2 className="page-heading-focus" tabIndex={-1} data-page-heading>
          {encounter.enemy.name}
        </h2>
      </header>

      <ol className="end-of-fight-strip" data-testid="end-of-fight-strip">
        {fightState.beatLog.map((entry, idx) => (
          <li key={`strip-${idx}`} className="strip-panel" data-testid={`strip-panel-${idx}`}>
            <div className="combat-art-stage">
              <ResolvedPanelImage
                src={entry.image}
                alt={
                  entry.kind === 'beat'
                    ? `${encounter.enemy.name} — beat ${entry.beatNumber}`
                    : `${encounter.enemy.name} — story moment`
                }
              />
            </div>
            {entry.kind === 'beat' ? (
              <div className="strip-panel__captions">
                {entry.tellCaption && (
                  <div className="combat-tell-box">{entry.tellCaption}</div>
                )}
                <div className="story-caption-box">{entry.resultCaption}</div>
              </div>
            ) : (
              <div className="strip-panel__captions">
                <div className="story-caption-box">{entry.caption}</div>
                <div className="combat-tell-box">
                  <strong>Chosen:</strong> {entry.chosenLabel}
                </div>
              </div>
            )}
          </li>
        ))}
      </ol>

      <button
        type="button"
        className="story-choice-btn end-of-fight-continue"
        onClick={onContinue}
      >
        Continue
      </button>
    </section>
  );
}
