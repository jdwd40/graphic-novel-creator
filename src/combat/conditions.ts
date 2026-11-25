import type { Condition, StoryStateSnapshot } from './types';

export const EMPTY_STORY_STATE: StoryStateSnapshot = {
  flags: {},
  items: [],
  stats: {},
};

export function evaluateCondition(
  condition: Condition | undefined,
  state: StoryStateSnapshot,
): boolean {
  if (!condition) {
    return true;
  }

  if ('flag' in condition) {
    return Boolean(state.flags?.[condition.flag]);
  }

  if ('item' in condition) {
    return Array.isArray(state.items) && state.items.includes(condition.item);
  }

  if ('stat' in condition) {
    const actual = state.stats?.[condition.stat];
    if (typeof actual !== 'number' || Number.isNaN(actual)) {
      return false;
    }
    switch (condition.op) {
      case 'gt':
        return actual > condition.value;
      case 'gte':
        return actual >= condition.value;
      case 'lt':
        return actual < condition.value;
      case 'lte':
        return actual <= condition.value;
      case 'eq':
        return actual === condition.value;
      case 'neq':
        return actual !== condition.value;
      default:
        return false;
    }
  }

  return false;
}
