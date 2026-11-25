export interface HealthPipsProps {
  label: string;
  current: number;
  max: number;
  buffer?: number;
  maxBuffer?: number;
  variant: 'player' | 'enemy';
  lostCount?: number;
  bufferLostCount?: number;
}

export function HealthPips({
  label,
  current,
  max,
  buffer = 0,
  maxBuffer = 0,
  variant,
  lostCount = 0,
  bufferLostCount = 0,
}: HealthPipsProps) {
  const ariaLabel =
    variant === 'player'
      ? `${label} ${current} of ${max}, armour ${buffer}`
      : `${label} ${current} of ${max}`;

  return (
    <div
      className={`pip-row pip-row--${variant}`}
      role="img"
      aria-label={ariaLabel}
      data-testid={`pip-row-${variant}`}
    >
      {maxBuffer > 0 &&
        Array.from({ length: maxBuffer }, (_, idx) => {
          const filled = idx < buffer;
          const justLost = !filled && idx >= buffer && idx < buffer + bufferLostCount;
          return (
            <span
              key={`buf-${idx}`}
              aria-hidden="true"
              className={`pip pip--buffer ${filled ? 'is-filled' : 'is-empty'} ${justLost ? 'is-breaking' : ''}`}
            />
          );
        })}

      {Array.from({ length: max }, (_, idx) => {
        const filled = idx < current;
        const justLost = !filled && idx >= current && idx < current + lostCount;
        return (
          <span
            key={`hp-${idx}`}
            aria-hidden="true"
            className={`pip pip--${variant} ${filled ? 'is-filled' : 'is-empty'} ${justLost ? 'is-breaking' : ''}`}
          />
        );
      })}
    </div>
  );
}
