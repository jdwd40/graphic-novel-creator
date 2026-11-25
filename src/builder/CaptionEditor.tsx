import {
  BUILTIN_CLEAR_TELL_CAPTIONS,
  BUILTIN_RESULT_CAPTIONS,
  BUILTIN_VAGUE_TELL_CAPTIONS,
} from '../combat/captions';
import { VALID_MOVES } from '../combat/constants';
import type { Encounter, Move, ResultCaptionKey } from '../combat/types';

export interface CaptionEditorProps {
  encounter: Encounter;
  onUpdate: (nextEncounter: Encounter) => void;
}

const RESULT_POOL_META: ReadonlyArray<{ key: ResultCaptionKey; label: string }> = [
  { key: 'strikeTraded', label: 'Strike · Steady' },
  { key: 'strikePressed', label: 'Strike · Press' },
  { key: 'strikeGuarded', label: 'Strike · Guard' },
  { key: 'heavyLanded', label: 'Heavy · Steady' },
  { key: 'heavyPressed', label: 'Heavy · Press' },
  { key: 'heavyBlocked', label: 'Heavy · Guard (Blocked)' },
  { key: 'openPunished', label: 'Open · Press' },
  { key: 'openSteady', label: 'Open · Steady' },
  { key: 'openGuarded', label: 'Open · Guard' },
];

function formatMoveLabel(move: Move): string {
  return move.charAt(0).toUpperCase() + move.slice(1);
}

export function CaptionEditor({ encounter, onUpdate }: CaptionEditorProps) {
  const tellBuiltinSource =
    encounter.tellClarity === 'vague'
      ? BUILTIN_VAGUE_TELL_CAPTIONS
      : BUILTIN_CLEAR_TELL_CAPTIONS;

  const updateTellPool = (move: Move, pool: string[] | undefined) => {
    const nextTell = { ...(encounter.captions?.tell ?? {}) };
    if (!pool || pool.length === 0) {
      delete nextTell[move];
    } else {
      nextTell[move] = pool.slice(0, 3);
    }
    onUpdate({
      ...encounter,
      captions: {
        ...encounter.captions,
        tell: nextTell,
      },
    });
  };

  const updateResultPool = (key: ResultCaptionKey, pool: string[] | undefined) => {
    const nextResult = { ...(encounter.captions?.result ?? {}) };
    if (!pool || pool.length === 0) {
      delete nextResult[key];
    } else {
      nextResult[key] = pool.slice(0, 3);
    }
    onUpdate({
      ...encounter,
      captions: {
        ...encounter.captions,
        result: nextResult,
      },
    });
  };

  return (
    <details className="inspector-advanced" data-testid="caption-editor">
      <summary>Captions (tells &amp; results)</summary>
      <div className="inspector-advanced-body">
        <h4>Tell captions</h4>
        {VALID_MOVES.map((move) => {
          const customPool = encounter.captions?.tell?.[move] ?? [];
          const rows = customPool.length > 0 ? customPool : [''];
          const builtins = tellBuiltinSource[move];

          return (
            <div key={`tell-${move}`} className="caption-pool" data-testid={`tell-pool-${move}`}>
              <div className="caption-pool__header">
                <span className="inspector-label">Tell: {formatMoveLabel(move)}</span>
                <button
                  type="button"
                  onClick={() => updateTellPool(move, undefined)}
                  aria-label={`Reset ${move} tells`}
                >
                  Reset
                </button>
              </div>
              {rows.map((val, idx) => (
                <input
                  key={`tell-${move}-${idx}`}
                  type="text"
                  aria-label={`Tell ${move} caption ${idx + 1}`}
                  placeholder={builtins[idx % builtins.length]}
                  value={val}
                  onChange={(e) => {
                    const next = [...rows];
                    next[idx] = e.target.value;
                    updateTellPool(move, next);
                  }}
                />
              ))}
              <button
                type="button"
                disabled={rows.length >= 3}
                aria-label={`Add ${move} tell caption`}
                onClick={() => {
                  if (rows.length >= 3) return;
                  updateTellPool(move, [...rows, '']);
                }}
              >
                Add caption
              </button>
            </div>
          );
        })}

        <h4>Result captions</h4>
        {RESULT_POOL_META.map(({ key, label }) => {
          const customPool = encounter.captions?.result?.[key] ?? [];
          const rows = customPool.length > 0 ? customPool : [''];
          const builtins = BUILTIN_RESULT_CAPTIONS[key];

          return (
            <div key={`result-${key}`} className="caption-pool" data-testid={`result-pool-${key}`}>
              <div className="caption-pool__header">
                <span className="inspector-label">{label}</span>
                <button
                  type="button"
                  onClick={() => updateResultPool(key, undefined)}
                  aria-label={`Reset ${key} results`}
                >
                  Reset
                </button>
              </div>
              {rows.map((val, idx) => (
                <input
                  key={`result-${key}-${idx}`}
                  type="text"
                  aria-label={`Result ${key} caption ${idx + 1}`}
                  placeholder={builtins[idx % builtins.length]}
                  value={val}
                  onChange={(e) => {
                    const next = [...rows];
                    next[idx] = e.target.value;
                    updateResultPool(key, next);
                  }}
                />
              ))}
              <button
                type="button"
                disabled={rows.length >= 3}
                aria-label={`Add ${key} result caption`}
                onClick={() => {
                  if (rows.length >= 3) return;
                  updateResultPool(key, [...rows, '']);
                }}
              >
                Add caption
              </button>
            </div>
          );
        })}
      </div>
    </details>
  );
}
