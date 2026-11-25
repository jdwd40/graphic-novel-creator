export interface ChoiceListItem {
  id: string;
  label: string;
}

export interface ChoiceListProps {
  choices: readonly ChoiceListItem[];
  onSelect: (choiceId: string) => void;
  ariaLabel?: string;
}

export function ChoiceList({
  choices,
  onSelect,
  ariaLabel = 'Story choices',
}: ChoiceListProps) {
  return (
    <div className="story-choices-list" role="group" aria-label={ariaLabel}>
      {choices.map((choice) => (
        <button
          key={choice.id}
          type="button"
          className="story-choice-btn"
          onClick={() => onSelect(choice.id)}
        >
          {choice.label}
        </button>
      ))}
    </div>
  );
}
