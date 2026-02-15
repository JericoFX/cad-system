import { isEnvBrowser } from '~/utils/misc';
import { generateRequestId, waitForResponse, injectMockEvent } from './eventBus';

let mockEnabled = false;
let loadingDelay = 300;

export function isMockEnabled(): boolean {
  return isEnvBrowser() && import.meta.env.DEV && mockEnabled;
}

export function setMockEnabled(enabled: boolean): void {
  mockEnabled = enabled;
}

export function setLoadingDelay(ms: number): void {
  loadingDelay = ms;
}

export async function mockFetchNui<TResponse>(eventName: string, data?: unknown): Promise<TResponse> {
  const requestId = generateRequestId();

  injectMockEvent(`cad:req:${eventName}`, { requestId, payload: data }, loadingDelay);

  return waitForResponse<TResponse>(requestId, 10000);
}

export function setupFetchNuiInterceptor(originalFetchNui: Function): void {
  if (!isEnvBrowser()) return;

  const originalFn = originalFetchNui;

  Object.defineProperty(window, 'fetchNuiInterceptor', {
    value: originalFn,
    writable: false,
  });
}
