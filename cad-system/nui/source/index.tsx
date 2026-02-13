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
    const { initializeMockNUI, setMockUser } = await import('./mocks/mockNUI');
    initializeMockNUI();
    setMockUser(CONFIG.MOCK_USER.id, CONFIG.MOCK_USER.badge);
    await userActions.init();
    console.log('[DEV] Mock mode enabled');
    return;
  }

  await userActions.init();
})();
