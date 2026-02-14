import { render } from 'solid-js/web';
import { CONFIG } from './config';
import { registerAllCommands } from './commands';
import { App } from './App';
import { userActions } from './stores/userStore';
import { featureActions } from './stores/featureStore';
import { codeCatalogActions } from './stores/codeCatalogStore';

const root = document.getElementById('root');
if (root) {
  render(() => <App />, root);
}

void (async () => {
  await featureActions.load();
  await codeCatalogActions.load();

  registerAllCommands();

  if (CONFIG.USE_MOCK_DATA) {
    // Initialize new event-based mock system
    const { initMockSystem, setMockEnabled, loadScenario, emptyScenario } = await import('./mocks');
    initMockSystem();
    setMockEnabled(true);
    
    // Load empty scenario by default
    await loadScenario(emptyScenario);
    
    await userActions.init();
    console.log('[DEV] Mock system enabled - event-based mode');
    return;
  }

  await userActions.init();
})();
