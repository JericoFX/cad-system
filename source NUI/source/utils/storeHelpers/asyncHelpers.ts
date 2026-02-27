/**
 * Async Operation Helpers
 * 
 * Utility functions for handling async operations with standardized error handling
 */

import { fetchNui } from '~/utils/fetchNui';

/**
 * Safely execute an async fetch operation with standardized error handling
 * @param endpoint The NUI endpoint to call
 * @param data The data to send
 * @param options Optional configuration
 * @returns Promise with standardized result
 */
export async function safeFetch<T>(
  endpoint: string, 
  data: any,
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

/**
 * Execute an async operation with loading state management
 * @param setState The state setter function
 * @param operation The async operation to execute
 * @param options Optional configuration
 * @returns Promise with operation result
 */
export async function withLoadingState<T>(
  setState: Function,
  operation: () => Promise<T>,
  options?: {
    loadingStateKey?: string;
    errorStateKey?: string;
    onSuccess?: (result: T) => void;
    onError?: (error: string) => void;
  }
): Promise<T | { error: string }> {
  // Set loading state
  if (options?.loadingStateKey) {
    setState(options.loadingStateKey, true);
  }
  
  // Clear previous error
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
    
    // Set error state
    if (options?.errorStateKey) {
      setState(options.errorStateKey, errorMessage);
    }
    
    return { error: errorMessage };
  } finally {
    // Clear loading state
    if (options?.loadingStateKey) {
      setState(options.loadingStateKey, false);
    }
  }
}

/**
 * Retry an async operation with exponential backoff
 * @param operation The async operation to retry
 * @param maxRetries Maximum number of retries
 * @param baseDelay Base delay in milliseconds
 * @returns Promise with operation result
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: any;
  
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      if (i < maxRetries) {
        // Exponential backoff
        const delay = baseDelay * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}