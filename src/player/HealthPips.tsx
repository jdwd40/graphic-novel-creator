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
      {maxBuffer > 0 && (
        <div className="pip-group pip-group--buffer">
          {Array.from({ length: maxBuffer }, (_, idx) => {
            const filled = idx < buffer;
            const justLost = !filled && idx >= buffer && idx < buffer + bufferLostCount;
            return (
              <span
                key={`buf-${idx}`}
                aria-hidden="true"
                data-pip-shape="shield"
                className={`pip pip--buffer ${filled ? 'is-filled' : 'is-empty'} ${justLost ? 'is-breaking' : ''}`}
              >
                <svg viewBox="0 0 16 16" className="pip-shield-svg" aria-hidden="true">
                  <path
                    d="M8 1.2L13.8 3.6V8.1C13.8 11.4 11.3 13.8 8 14.8C4.7 13.8 2.2 11.4 2.2 8.1V3.6L8 1.2Z"
                  />
                </svg>
              </span>
            );
          })}
        </div>
      )}

      <div className="pip-group pip-group--health">
        {Array.from({ length: max }, (_, idx) => {
          const filled = idx < current;
          const justLost = !filled && idx >= current && idx < current + lostCount;
          return (
            <span
              key={`hp-${idx}`}
              aria-hidden="true"
              data-pip-shape="circle"
              className={`pip pip--${variant} ${filled ? 'is-filled' : 'is-empty'} ${justLost ? 'is-breaking' : ''}`}
            >
              <svg viewBox="0 0 16 16" className="pip-svg" aria-hidden="true">
                {variant === 'player' ? (
                  <path d="M8 14.2C3.2 10.6 1.4 8.3 1.4 5.7 1.4 3.7 2.9 2.2 4.8 2.2c1.3 0 2.5.7 3.2 1.8.7-1.1 1.9-1.8 3.2-1.8 1.9 0 3.4 1.5 3.4 3.5 0 2.6-1.8 4.9-6.6 8.5Z" />
                ) : (
                  <path d="M8 1.2 14.2 8 8 14.8 1.8 8Z" />
                )}
              </svg>
            </span>
          );
        })}
      </div>
    </div>
  );
}
