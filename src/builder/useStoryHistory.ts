import { useCallback, useEffect, useRef, useState } from 'react';
import type { Story } from '../story/types';

export const MAX_STORY_HISTORY = 50;
const COALESCE_WINDOW_MS = 700;

interface HistoryBuckets {
  past: Story[];
  future: Story[];
}

/**
 * Undo/redo history stack for the story builder with typing-coalescing support.
 */
export function useStoryHistory(storyId: string) {
  const bucketsRef = useRef<HistoryBuckets>({ past: [], future: [] });
  const lastEditRef = useRef<{ key: string | null; at: number }>({ key: null, at: 0 });
  const [, setTick] = useState(0);

  const resetHistory = useCallback(() => {
    bucketsRef.current = { past: [], future: [] };
    lastEditRef.current = { key: null, at: 0 };
    setTick((t) => t + 1);
  }, []);

  useEffect(() => {
    resetHistory();
  }, [storyId, resetHistory]);

  const pushChange = useCallback((prevStory: Story, coalesceKey?: string) => {
    const now = Date.now();
    const shouldCoalesce =
      Boolean(coalesceKey) &&
      lastEditRef.current.key === coalesceKey &&
      now - lastEditRef.current.at < COALESCE_WINDOW_MS &&
      bucketsRef.current.past.length > 0;

    if (shouldCoalesce) {
      lastEditRef.current = { key: coalesceKey ?? null, at: now };
      bucketsRef.current.future = [];
      setTick((t) => t + 1);
      return;
    }

    const nextPast = [...bucketsRef.current.past, prevStory];
    if (nextPast.length > MAX_STORY_HISTORY) {
      nextPast.shift();
    }
    bucketsRef.current = { past: nextPast, future: [] };
    lastEditRef.current = { key: coalesceKey ?? null, at: now };
    setTick((t) => t + 1);
  }, []);

  const undo = useCallback((currentStory: Story): Story | null => {
    const { past, future } = bucketsRef.current;
    if (past.length === 0) return null;
    const restored = past[past.length - 1];
    bucketsRef.current = {
      past: past.slice(0, -1),
      future: [currentStory, ...future].slice(0, MAX_STORY_HISTORY),
    };
    lastEditRef.current = { key: null, at: 0 };
    setTick((t) => t + 1);
    return restored;
  }, []);

  const redo = useCallback((currentStory: Story): Story | null => {
    const { past, future } = bucketsRef.current;
    if (future.length === 0) return null;
    const restored = future[0];
    const nextPast = [...past, currentStory].slice(-MAX_STORY_HISTORY);
    bucketsRef.current = {
      past: nextPast,
      future: future.slice(1),
    };
    lastEditRef.current = { key: null, at: 0 };
    setTick((t) => t + 1);
    return restored;
  }, []);

  return {
    canUndo: bucketsRef.current.past.length > 0,
    canRedo: bucketsRef.current.future.length > 0,
    pastCount: bucketsRef.current.past.length,
    pushChange,
    undo,
    redo,
    resetHistory,
  };
}
