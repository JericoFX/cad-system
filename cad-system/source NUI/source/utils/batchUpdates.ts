import { batch } from 'solid-js';

/**
 * Wraps a function to execute all state updates within a batch.
 * This prevents multiple re-renders when updating multiple state properties.
 */
export function withBatch<T extends (...args: any[]) => any>(fn: T): T {
  return ((...args: Parameters<T>) => {
    return batch(() => fn(...args));
  }) as T;
}

/**
 * Executes multiple state update functions in a single batch.
 * Useful when you need to update multiple unrelated state properties.
 */
export function batchUpdates(...fns: (() => void)[]) {
  batch(() => {
    fns.forEach(fn => fn());
  });
}
