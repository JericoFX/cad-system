import { isEnvBrowser } from '~/utils/misc';

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
}

const pendingRequests = new Map<string, PendingRequest>();
let requestCounter = 0;

export function generateRequestId(): string {
  requestCounter += 1;
  return `req_${Date.now()}_${requestCounter}`;
}

export function waitForResponse<T>(requestId: string, timeout = 5000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(new Error(`Mock request timeout: ${requestId}`));
    }, timeout);

    pendingRequests.set(requestId, { resolve: resolve as (value: unknown) => void, reject, timer });
  });
}

export function resolveRequest(requestId: string, data: unknown): void {
  const pending = pendingRequests.get(requestId);
  if (pending) {
    clearTimeout(pending.timer);
    pendingRequests.delete(requestId);
    pending.resolve(data);
  }
}

export function rejectRequest(requestId: string, error: unknown): void {
  const pending = pendingRequests.get(requestId);
  if (pending) {
    clearTimeout(pending.timer);
    pendingRequests.delete(requestId);
    pending.reject(error);
  }
}

export function injectMockEvent(action: string, data: unknown, delay = 100): void {
  if (!isEnvBrowser()) return;

  setTimeout(() => {
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { action, data },
      })
    );
  }, delay);
}

export function clearPendingRequests(): void {
  pendingRequests.forEach((pending) => {
    clearTimeout(pending.timer);
    pending.reject(new Error('Mock system reset'));
  });
  pendingRequests.clear();
  requestCounter = 0;
}
