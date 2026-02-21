import { createStore } from 'solid-js/store';

export interface UIPreferences {
  theme: 'dark' | 'light' | 'system';
  fontSize: 'small' | 'medium' | 'large';
  showTimestamps: boolean;
  compactMode: boolean;
  soundEnabled: boolean;
  animationsEnabled: boolean;
  sidebarCollapsed: boolean;
}

const STORAGE_KEY = 'cad-ui-preferences-v1';

const defaultPreferences: UIPreferences = {
  theme: 'dark',
  fontSize: 'medium',
  showTimestamps: true,
  compactMode: false,
  soundEnabled: true,
  animationsEnabled: true,
  sidebarCollapsed: false,
};

function loadPreferences(): UIPreferences {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...defaultPreferences, ...parsed };
    }
  } catch (error) {
    console.warn('Failed to load preferences from localStorage:', error);
  }
  return defaultPreferences;
}

function savePreferences(prefs: UIPreferences) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch (error) {
    console.warn('Failed to save preferences to localStorage:', error);
  }
}

const initialPreferences = loadPreferences();

export const [preferencesState, setPreferencesState] = createStore<UIPreferences>(initialPreferences);

export const preferencesActions = {
  setTheme: (theme: UIPreferences['theme']) => {
    setPreferencesState('theme', theme);
    savePreferences(preferencesState);
  },
  
  setFontSize: (size: UIPreferences['fontSize']) => {
    setPreferencesState('fontSize', size);
    savePreferences(preferencesState);
  },
  
  setShowTimestamps: (show: boolean) => {
    setPreferencesState('showTimestamps', show);
    savePreferences(preferencesState);
  },
  
  setCompactMode: (compact: boolean) => {
    setPreferencesState('compactMode', compact);
    savePreferences(preferencesState);
  },
  
  setSoundEnabled: (enabled: boolean) => {
    setPreferencesState('soundEnabled', enabled);
    savePreferences(preferencesState);
  },
  
  setAnimationsEnabled: (enabled: boolean) => {
    setPreferencesState('animationsEnabled', enabled);
    savePreferences(preferencesState);
  },
  
  setSidebarCollapsed: (collapsed: boolean) => {
    setPreferencesState('sidebarCollapsed', collapsed);
    savePreferences(preferencesState);
  },
  
  resetToDefaults: () => {
    setPreferencesState({ ...defaultPreferences });
    savePreferences(defaultPreferences);
  },
  
  getPreferences: () => preferencesState,
};
