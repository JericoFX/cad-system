import { render } from 'solid-js/web';
import { isEnvBrowser } from './utils/misc';
import { registerAllCommands } from './commands';
import { App } from './App';
import { userActions } from './stores/userStore';
import { featureActions } from './stores/featureStore';
import { codeCatalogActions } from './stores/codeCatalogStore';
import { UIProvider } from './components/ui';

import { initNuiSystem } from './hooks/useNui';

const root = document.getElementById('root');
if (root) {
  render(
    () => (
      <UIProvider>
        <App />
      </UIProvider>
    ),
    root,
  );
} else {
  console.error('[APP] Root element not found!');
}

void (async () => {
  try {
    console.log('[APP] Initializing CAD...');

    await featureActions.load();
    console.log('[APP] Features loaded');

    await codeCatalogActions.load();
    console.log('[APP] Code catalog loaded');

    registerAllCommands();
    console.log('[APP] Commands registered');

    if (isEnvBrowser()) {
      console.log('[APP] Browser mode detected, initializing mock system...');

      const { initMockSystem, setMockEnabled, loadScenario, emptyScenario } =
        await import('./mocks');

      console.log('[APP] Mock module loaded');

      initMockSystem();
      console.log('[APP] Mock system initialized');

      setMockEnabled(true);
      console.log('[APP] Mock enabled');

      await loadScenario(emptyScenario);
      console.log('[APP] Empty scenario loaded');

      initNuiSystem();
      console.log('[APP] NUI system initialized in browser mode');

      await userActions.init();
      console.log('[APP] User initialized');

      console.log('[DEV] Mock system enabled - event-based mode');
      return;
    }

    console.log('[APP] FiveM mode, initializing NUI system...');
    initNuiSystem();

    await userActions.init();
    console.log('[APP] User initialized');
  } catch (error) {
    console.error('[APP] Fatal error during initialization:', error);
  }
})();
