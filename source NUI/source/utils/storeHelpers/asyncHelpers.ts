import { fetchNui } from '~/utils/fetchNui';

export async function safeFetch<T>(
  endpoint: string,
  data: unknown,
  options?: {
    onSuccess?: (result: T) => void;
    onError?: (error: string) => void;
  }
): Promise<{ ok: boolean; data?: T; error?: string }> {
  try {
    const response = await fetchNui<{ ok: boolean; data?: T; error?: string }>(endpoint, data);
    if (!response?.ok) {
      const error = response?.error || 'Unknown error';
      options?.onError?.(error);
      return { ok: false, error };
    }
    options?.onSuccess?.(response.data!);
    return { ok: true, data: response.data };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Network error';
    options?.onError?.(errorMessage);
    return { ok: false, error: errorMessage };
  }
}

export async function withLoadingState<T>(
  setState: (key: string, value: unknown) => void,
  operation: () => Promise<T>,
  options?: {
    loadingStateKey?: string;
    errorStateKey?: string;
    onSuccess?: (result: T) => void;
    onError?: (error: string) => void;
  }
): Promise<T | { error: string }> {
  if (options?.loadingStateKey) {
    setState(options.loadingStateKey, true);
  }

  if (options?.errorStateKey) {
    setState(options.errorStateKey, null);
  }

  try {
    const result = await operation();
    options?.onSuccess?.(result);
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Operation failed';
    options?.onError?.(errorMessage);

    if (options?.errorStateKey) {
      setState(options.errorStateKey, errorMessage);
    }

    return { error: errorMessage };
  } finally {
    if (options?.loadingStateKey) {
      setState(options.loadingStateKey, false);
    }
  }
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: unknown;

  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (i < maxRetries) {
        const delay = baseDelay * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}
