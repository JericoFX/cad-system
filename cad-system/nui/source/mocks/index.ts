// Core exports
export * from './core/eventBus';
export * from './core/requestInterceptor';
export * from './core/scenarioLoader';

// Types
export * from './types';

// Scenarios
export * from './scenarios';

// Components
export { MockController } from './components/MockController';

// Data
export * from './data';

// Handlers (internal use)
export * from './handlers';

// Initialization
import { initializeAllHandlers } from './handlers';
import { isEnvBrowser } from '~/utils/misc';

export function initMockSystem(): void {
  if (!isEnvBrowser()) {
    console.log('[MOCK] Not in browser, skipping mock initialization');
    return;
  }
  
  console.log('[MOCK] Initializing mock system...');
  initializeAllHandlers();
  console.log('[MOCK] Mock system initialized');
}
