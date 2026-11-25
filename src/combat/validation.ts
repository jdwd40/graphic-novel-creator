import {
  VALID_BEHAVIOUR_PRESETS,
  VALID_MOVES,
  VALID_TELL_CLARITIES,
  VALID_TOUGHNESS_PRESETS,
} from './constants';
import type { Encounter, Move } from './types';

export type ValidationResult =
  | { valid: true; encounter: Encounter; errors: [] }
  | { valid: false; errors: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateMoveList(value: unknown, fieldPath: string, errors: string[]): void {
  if (!Array.isArray(value)) {
    errors.push(`${fieldPath} must be an array of moves.`);
    return;
  }
  if (value.length === 0) {
    errors.push(`${fieldPath} must contain at least one move.`);
    return;
  }
  value.forEach((move, idx) => {
    if (typeof move !== 'string' || !VALID_MOVES.includes(move as Move)) {
      errors.push(
        `${fieldPath}[${idx}] has unknown move "${String(move)}". Expected one of: ${VALID_MOVES.join(', ')}.`,
      );
    }
  });
}

export function validateEncounterJson(input: unknown): ValidationResult {
  const errors: string[] = [];

  if (!isRecord(input)) {
    return { valid: false, errors: ['encounter must be a JSON object.'] };
  }

  if (input.type !== 'encounter') {
    errors.push(`type must be "encounter", got "${String(input.type)}".`);
  }

  if (!isRecord(input.enemy)) {
    errors.push('enemy must be an object.');
  } else {
    if (typeof input.enemy.name !== 'string' || input.enemy.name.trim() === '') {
      errors.push('enemy.name is required and must be a non-empty string.');
    }
    if (typeof input.enemy.image !== 'string' || input.enemy.image.trim() === '') {
      errors.push('enemy.image is required and must be a non-empty string.');
    }
    if (
      typeof input.enemy.toughness !== 'string' ||
      !VALID_TOUGHNESS_PRESETS.includes(input.enemy.toughness as Encounter['enemy']['toughness'])
    ) {
      errors.push(
        `enemy.toughness must be one of: ${VALID_TOUGHNESS_PRESETS.join(', ')}.`,
      );
    }
    if (
      typeof input.enemy.health !== 'number' ||
      !Number.isInteger(input.enemy.health) ||
      input.enemy.health < 1
    ) {
      errors.push('enemy.health must be an integer >= 1.');
    }
    if (
      typeof input.enemy.hit !== 'number' ||
      !Number.isInteger(input.enemy.hit) ||
      input.enemy.hit < 0
    ) {
      errors.push('enemy.hit must be an integer >= 0.');
    }
  }

  if (
    typeof input.behaviour !== 'string' ||
    !VALID_BEHAVIOUR_PRESETS.includes(input.behaviour as Encounter['behaviour'])
  ) {
    errors.push(
      `behaviour must be one of: ${VALID_BEHAVIOUR_PRESETS.join(', ')}.`,
    );
  }

  validateMoveList(input.pattern, 'pattern', errors);

  if (input.altPattern !== undefined && input.altPattern !== null) {
    validateMoveList(input.altPattern, 'altPattern', errors);
  }

  if (
    typeof input.tellClarity !== 'string' ||
    !VALID_TELL_CLARITIES.includes(input.tellClarity as Encounter['tellClarity'])
  ) {
    errors.push(
      `tellClarity must be one of: ${VALID_TELL_CLARITIES.join(', ')}.`,
    );
  }

  if (typeof input.allowRetreat !== 'boolean') {
    errors.push('allowRetreat must be a boolean.');
  }

  if (!isRecord(input.exits)) {
    errors.push('exits must be an object.');
  } else {
    if (!isRecord(input.exits.victory)) {
      errors.push('exits.victory is required.');
    }
    if (!isRecord(input.exits.defeat)) {
      errors.push('exits.defeat is required.');
    }
    for (const [key, exitVal] of Object.entries(input.exits)) {
      if (!isRecord(exitVal) || !Array.isArray(exitVal.effects)) {
        errors.push(`exits.${key}.effects must be an array.`);
      }
    }
  }

  if (input.phases !== undefined) {
    if (!Array.isArray(input.phases)) {
      errors.push('phases must be an array.');
    } else {
      input.phases.forEach((phase, idx) => {
        if (!isRecord(phase)) {
          errors.push(`phases[${idx}] must be an object.`);
          return;
        }
        if (typeof phase.healthAtMost !== 'number' || phase.healthAtMost < 1) {
          errors.push(`phases[${idx}].healthAtMost must be a number >= 1.`);
        }
        validateMoveList(phase.pattern, `phases[${idx}].pattern`, errors);
      });
    }
  }

  if (input.moments !== undefined) {
    if (!Array.isArray(input.moments)) {
      errors.push('moments must be an array.');
    } else {
      input.moments.forEach((moment, idx) => {
        if (!isRecord(moment)) {
          errors.push(`moments[${idx}] must be an object.`);
          return;
        }
        if (typeof moment.caption !== 'string' || moment.caption.trim() === '') {
          errors.push(`moments[${idx}].caption must be a non-empty string.`);
        }
        if (!Array.isArray(moment.choices) || moment.choices.length === 0) {
          errors.push(`moments[${idx}].choices must contain at least one choice.`);
        }
      });
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    encounter: input as unknown as Encounter,
    errors: [],
  };
}
