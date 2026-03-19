import { createSignal } from 'solid-js';
import type { Accessor } from 'solid-js';
import { fetchNui } from '~/utils/fetchNui';
import { terminalActions } from '~/stores/terminalStore';

interface AsyncActionOptions<TResponse> {
  endpoint: string;
  successMessage?: string | ((res: TResponse) => string);
  errorMessage?: string | ((err: string) => string);
  successType?: 'output' | 'system';
}

interface AsyncActionResult<TRequest, TResponse> {
  loading: Accessor<boolean>;
  execute: (data: TRequest) => Promise<TResponse | null>;
}

export function useAsyncAction<TRequest = any, TResponse = any>(
  options: AsyncActionOptions<TResponse>
): AsyncActionResult<TRequest, TResponse> {
  const [loading, setLoading] = createSignal(false);

  const execute = async (data: TRequest): Promise<TResponse | null> => {
    setLoading(true);
    try {
      const response = await fetchNui<TResponse>(options.endpoint, data);

      if (response && typeof response === 'object' && 'ok' in response && !(response as any).ok) {
        const errorMsg = (response as any).error || 'Unknown error';
        const message = typeof options.errorMessage === 'function'
          ? options.errorMessage(errorMsg)
          : options.errorMessage || errorMsg;
        terminalActions.addLine(message, 'error');
        return null;
      }

      if (options.successMessage) {
        const message = typeof options.successMessage === 'function'
          ? options.successMessage(response)
          : options.successMessage;
        terminalActions.addLine(message, options.successType || 'output');
      }

      return response;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const message = typeof options.errorMessage === 'function'
        ? options.errorMessage(errorMsg)
        : options.errorMessage || `${options.endpoint} failed: ${errorMsg}`;
      terminalActions.addLine(message, 'error');
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { loading, execute };
}
