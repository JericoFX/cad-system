export * from './core/eventBus';
export * from './core/requestInterceptor';
export * from './core/scenarioLoader';

export * from './types';

export * from './scenarios';

export { MockController } from './components/MockController';

export * from './data';

export * from './handlers';

import { initializeAllHandlers } from './handlers';
import { isEnvBrowser } from '~/utils/misc';

export function initMockSystem(): void {
  if (!isEnvBrowser()) {
    return;
  }

  initializeAllHandlers();
}
