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

/**
 * Executes async operations and batches state updates on completion.
 * Useful for async operations that need to update multiple state properties.
 */
export async function asyncBatchUpdates<T>(
  asyncFn: () => Promise<T>,
  ...fns: (() => void)[]
): Promise<T> {
  const result = await asyncFn();
  batch(() => {
    fns.forEach(fn => fn());
  });
  return result;
}

/**
 * Conditionally executes batch only if there are multiple updates.
 * Useful for avoiding unnecessary batch overhead on single updates.
 */
export function conditionalBatch(shouldBatch: boolean, fns: (() => void)[]) {
  if (shouldBatch && fns.length > 1) {
    batchUpdates(...fns);
  } else if (fns.length > 0) {
    fns[0]();
  }
}
