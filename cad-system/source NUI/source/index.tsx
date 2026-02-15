import { render } from 'solid-js/web';
import { isEnvBrowser } from './utils/misc';
import { registerAllCommands } from './commands';
import { App } from './App';
import { userActions } from './stores/userStore';
import { featureActions } from './stores/featureStore';
import { codeCatalogActions } from './stores/codeCatalogStore';

// Import NUI System
import { initNuiSystem } from './hooks/useNui';

const root = document.getElementById('root');
if (root) {
  render(() => <App />, root);
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
      
      // Initialize new event-based mock system (only in browser/dev)
      const { initMockSystem, setMockEnabled, loadScenario, emptyScenario } = await import('./mocks');
      
      console.log('[APP] Mock module loaded');
      
      initMockSystem();
      console.log('[APP] Mock system initialized');
      
      setMockEnabled(true);
      console.log('[APP] Mock enabled');
      
      // Load empty scenario by default
      await loadScenario(emptyScenario);
      console.log('[APP] Empty scenario loaded');
      
      await userActions.init();
      console.log('[APP] User initialized');
      
      console.log('[DEV] Mock system enabled - event-based mode');
      return;
    }

    // Initialize NUI event-driven system (FiveM production)
    console.log('[APP] FiveM mode, initializing NUI system...');
    initNuiSystem();

    await userActions.init();
    console.log('[APP] User initialized');
  } catch (error) {
    console.error('[APP] Fatal error during initialization:', error);
  }
})();
