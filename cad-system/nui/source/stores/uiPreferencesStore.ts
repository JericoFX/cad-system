
import { createStore } from 'solid-js/store';
import { CONFIG } from '~/config';

export type NavigationMode = 'dock' | 'terminal' | 'hybrid';

interface UIPreferencesState {
  navigationMode: NavigationMode;
  autoHideDockOnTyping: boolean;
  dockCollapsedInTerminalMode: boolean;
  terminalCompactInDockMode: boolean;
  showDockLabels: boolean;
  dockExpanded: boolean;
  isTerminalFocused: boolean;
  isTyping: boolean;
}

const getDefaultModeByRole = (): NavigationMode => {
  if (CONFIG.DOCK_ONLY) {
    return 'dock';
  }

  return CONFIG.UI_MODE as NavigationMode;
};

const loadFromStorage = (): Partial<UIPreferencesState> => {
  if (typeof window === 'undefined') return {};
  try {
    const saved = localStorage.getItem('cad-ui-preferences');
    if (saved) {
      const parsed = JSON.parse(saved);
      const savedMode: NavigationMode = parsed.navigationMode;
      return {
        navigationMode: CONFIG.DOCK_ONLY ? 'dock' : savedMode,
        autoHideDockOnTyping: parsed.autoHideDockOnTyping ?? true,
        dockCollapsedInTerminalMode: parsed.dockCollapsedInTerminalMode ?? true,
        terminalCompactInDockMode: parsed.terminalCompactInDockMode ?? true,
        showDockLabels: parsed.showDockLabels ?? false,
        dockExpanded: parsed.dockExpanded ?? false,
      };
    }
  } catch {
  }
  return {};
};

const saveToStorage = (state: Partial<UIPreferencesState>) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('cad-ui-preferences', JSON.stringify(state));
  } catch {
  }
};

const initialState: UIPreferencesState = {
  navigationMode: getDefaultModeByRole(),
  autoHideDockOnTyping: true,
  dockCollapsedInTerminalMode: true,
  terminalCompactInDockMode: true,
  showDockLabels: false,
  dockExpanded: false,
  isTerminalFocused: false,
  isTyping: false,
  ...loadFromStorage(),
};

export const [uiPrefsState, setUiPrefsState] = createStore<UIPreferencesState>(initialState);

export const uiPrefsActions = {
  setNavigationMode: (mode: NavigationMode) => {
    if (CONFIG.DOCK_ONLY) {
      setUiPrefsState('navigationMode', 'dock');
      uiPrefsActions.persist();
      return;
    }

    setUiPrefsState('navigationMode', mode);
    saveToStorage({
      navigationMode: mode,
      autoHideDockOnTyping: uiPrefsState.autoHideDockOnTyping,
      dockCollapsedInTerminalMode: uiPrefsState.dockCollapsedInTerminalMode,
      terminalCompactInDockMode: uiPrefsState.terminalCompactInDockMode,
      showDockLabels: uiPrefsState.showDockLabels,
      dockExpanded: uiPrefsState.dockExpanded,
    });
  },

  setAutoHideDockOnTyping: (value: boolean) => {
    setUiPrefsState('autoHideDockOnTyping', value);
    uiPrefsActions.persist();
  },

  setDockCollapsedInTerminalMode: (value: boolean) => {
    setUiPrefsState('dockCollapsedInTerminalMode', value);
    uiPrefsActions.persist();
  },

  setTerminalCompactInDockMode: (value: boolean) => {
    setUiPrefsState('terminalCompactInDockMode', value);
    uiPrefsActions.persist();
  },

  setShowDockLabels: (value: boolean) => {
    setUiPrefsState('showDockLabels', value);
    uiPrefsActions.persist();
  },

  toggleDockExpanded: () => {
    setUiPrefsState('dockExpanded', (prev) => !prev);
    uiPrefsActions.persist();
  },

  setTerminalFocused: (focused: boolean) => {
    setUiPrefsState('isTerminalFocused', focused);
  },

  setTyping: (typing: boolean) => {
    setUiPrefsState('isTyping', typing);
  },

  shouldShowDock: (): boolean => {
    if (CONFIG.DOCK_ONLY) {
      return true;
    }

    const mode = uiPrefsState.navigationMode;
    
    if (mode === 'terminal') {
      return !uiPrefsState.dockCollapsedInTerminalMode;
    }
    
    if (mode === 'hybrid' && uiPrefsState.autoHideDockOnTyping) {
      return !uiPrefsState.isTyping;
    }
    
    return true;
  },

  shouldShowTerminal: (): boolean => {
    if (CONFIG.DOCK_ONLY) {
      return false;
    }

    const mode = uiPrefsState.navigationMode;
    return mode === 'terminal' || mode === 'hybrid';
  },

  isTerminalCompact: (): boolean => {
    return uiPrefsState.navigationMode === 'dock' && uiPrefsState.terminalCompactInDockMode;
  },

  persist: () => {
    saveToStorage({
      navigationMode: uiPrefsState.navigationMode,
      autoHideDockOnTyping: uiPrefsState.autoHideDockOnTyping,
      dockCollapsedInTerminalMode: uiPrefsState.dockCollapsedInTerminalMode,
      terminalCompactInDockMode: uiPrefsState.terminalCompactInDockMode,
      showDockLabels: uiPrefsState.showDockLabels,
      dockExpanded: uiPrefsState.dockExpanded,
    });
  },

  resetToDefaults: () => {
    const defaults: UIPreferencesState = {
      navigationMode: getDefaultModeByRole(),
      autoHideDockOnTyping: true,
      dockCollapsedInTerminalMode: true,
      terminalCompactInDockMode: true,
      showDockLabels: false,
      dockExpanded: false,
      isTerminalFocused: false,
      isTyping: false,
    };
    setUiPrefsState(defaults);
    saveToStorage(defaults);
  },
};
