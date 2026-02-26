/**
 * App Store
 * Centralized visibility state for the entire CAD application
 * Controlled exclusively by Lua via NUI messages
 */

import { createStore } from 'solid-js/store';
import { isEnvBrowser } from '~/utils/misc';

interface AppState {
  isVisible: boolean;
}

const initialState: AppState = {
  isVisible: false,
};

export const [appState, setAppState] = createStore<AppState>(initialState);

export const appActions = {
  /**
   * Show the entire CAD application
   * Called when receiving 'cad:opened' from Lua
   */
  show: () => {
    setAppState('isVisible', isEnvBrowser() || true);
    console.log('[AppStore] CAD shown');
  },

  /**
   * Hide the entire CAD application
   * Called when receiving 'cad:closed' from Lua or when player closes UI
   */
  hide: () => {
    setAppState('isVisible', false);
    console.log('[AppStore] CAD hidden');
  },

  /**
   * Toggle visibility
   */
  toggle: () => {
    setAppState('isVisible', !appState.isVisible);
  },

  /**
   * Check if CAD is currently visible
   */
  isOpen: () => appState.isVisible,
};
