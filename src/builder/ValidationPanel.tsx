import type { ValidationMessage } from '../story/validation';

export interface ValidationPanelProps {
  messages: ValidationMessage[];
  onFocusNode: (nodeId: string) => void;
  onFocusItem?: (itemId: string) => void;
}

export function ValidationPanel({
  messages,
  onFocusNode,
  onFocusItem,
}: ValidationPanelProps) {
  const errors = messages.filter((m) => m.severity === 'error');
  const warnings = messages.filter((m) => m.severity === 'warning');

  return (
    <section className="validation-panel" aria-label="Story validation">
      <div className="validation-panel__summary">
        <strong>Validation:</strong>{' '}
        <span>
          {errors.length} {errors.length === 1 ? 'error' : 'errors'}
        </span>
        {', '}
        <span>
          {warnings.length} {warnings.length === 1 ? 'warning' : 'warnings'}
        </span>
      </div>
      {messages.length > 0 && (
        <ul className="validation-panel__list">
          {messages.map((msg) => (
            <li key={msg.id} className={`validation-item validation-item--${msg.severity}`}>
              <button
                type="button"
                className="validation-item__btn"
                onClick={() => {
                  if (msg.itemId && onFocusItem) {
                    onFocusItem(msg.itemId);
                  } else if (msg.nodeId) {
                    onFocusNode(msg.nodeId);
                  }
                }}
              >
                <span className="validation-item__tag">
                  {msg.severity === 'error' ? 'Error' : 'Warning'}
                </span>
                <span>{msg.message}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
