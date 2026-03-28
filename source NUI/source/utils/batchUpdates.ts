import { batch } from 'solid-js';

export function withBatch<T extends (...args: any[]) => any>(fn: T): T {
  return ((...args: Parameters<T>) => {
    return batch(() => fn(...args));
  }) as T;
}

export function batchUpdates(...fns: (() => void)[]): void {
  batch(() => {
    fns.forEach(fn => fn());
  });
}

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

export function conditionalBatch(shouldBatch: boolean, fns: (() => void)[]): void {
  if (shouldBatch && fns.length > 1) {
    batchUpdates(...fns);
  } else if (fns.length > 0) {
    fns[0]();
  }
}
