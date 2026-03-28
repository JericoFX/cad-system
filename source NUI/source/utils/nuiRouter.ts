import type { NuiMessage } from '~/types/nuiMessages';

type Handler<T = unknown> = (data: T) => void;

const handlers = new Map<string, Set<Handler>>();
let isInitialized = false;

export function initNuiRouter(): void {
  if (isInitialized) {
    console.log('[NUI Router] Already initialized');
    return;
  }

  window.addEventListener('message', (event: MessageEvent<NuiMessage>) => {
    const { action, data } = event.data;

    if (!action || typeof action !== 'string') return;

    const actionHandlers = handlers.get(action);
    if (actionHandlers && actionHandlers.size > 0) {
      actionHandlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`[NUI Router] Handler error for ${action}:`, error);
        }
      });
    }
  });

  isInitialized = true;
  console.log('[NUI Router] Initialized');
}

export function onNuiMessage<T = unknown>(
  action: string,
  handler: Handler<T>
): () => void {
  if (!handlers.has(action)) {
    handlers.set(action, new Set());
  }

  const actionHandlers = handlers.get(action)!;
  actionHandlers.add(handler as Handler);

  return () => {
    actionHandlers.delete(handler as Handler);
    if (actionHandlers.size === 0) {
      handlers.delete(action);
    }
  };
}

export async function sendNuiResponse<T = unknown>(
  action: string,
  data: T
): Promise<void> {
  console.log(`[NUI Router] Would send response: ${action}`, data);
}

export function getRegisteredActions(): string[] {
  return Array.from(handlers.keys());
}

export function isRouterInitialized(): boolean {
  return isInitialized;
}

export function clearAllHandlers(): void {
  handlers.clear();
  console.log('[NUI Router] All handlers cleared');
}
