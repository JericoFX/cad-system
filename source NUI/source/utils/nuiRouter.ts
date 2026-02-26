/**
 * NUI Router
 * Central message routing system for Lua <-> JS communication
 * Private module - use through useNui.ts
 */

import type { NuiMessage } from '~/types/nuiMessages';

type Handler<T = unknown> = (data: T) => void;

const handlers = new Map<string, Set<Handler>>();
let isInitialized = false;

/**
 * Initialize the NUI message router
 * Sets up the window message event listener
 */
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

/**
 * Subscribe to a specific NUI message action
 * @param action - The message action to listen for
 * @param handler - Handler function for the message data
 * @returns Unsubscribe function
 */
export function onNuiMessage<T = unknown>(
  action: string,
  handler: Handler<T>
): () => void {
  if (!handlers.has(action)) {
    handlers.set(action, new Set());
  }
  
  const actionHandlers = handlers.get(action)!;
  actionHandlers.add(handler as Handler);
  
  // Return unsubscribe function
  return () => {
    actionHandlers.delete(handler as Handler);
    if (actionHandlers.size === 0) {
      handlers.delete(action);
    }
  };
}

/**
 * Send a message back to Lua (for responses)
 * Uses fetchNui under the hood
 */
export async function sendNuiResponse<T = unknown>(
  action: string,
  data: T
): Promise<void> {
  // This will be implemented using the existing fetchNui mechanism
  // For now, just log that we would send a response
  console.log(`[NUI Router] Would send response: ${action}`, data);
}

/**
 * Get list of registered actions (for debugging)
 */
export function getRegisteredActions(): string[] {
  return Array.from(handlers.keys());
}

/**
 * Check if router is initialized
 */
export function isRouterInitialized(): boolean {
  return isInitialized;
}

/**
 * Clear all handlers (for testing/hot reload)
 */
export function clearAllHandlers(): void {
  handlers.clear();
  console.log('[NUI Router] All handlers cleared');
}
