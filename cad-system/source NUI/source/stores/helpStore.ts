
import { createStore } from 'solid-js/store';

export type HelpTab = 'all' | 'favorites' | 'byRole' | 'recent';

interface CommandFavorite {
  commandName: string;
  timestamp: number;
}

interface CommandUsage {
  commandName: string;
  timestamp: number;
}

interface HelpState {
  isOpen: boolean;
  activeTab: HelpTab;
  searchQuery: string;
  selectedCategory: string | null;
  favorites: CommandFavorite[];
  recentCommands: CommandUsage[];
  showOnlyAvailable: boolean;
  beginnerMode: boolean;
}

const loadFromStorage = <T>(key: string, defaultValue: T): T => {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const stored = localStorage.getItem(`cad-help-${key}`);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch {
    return defaultValue;
  }
};

const saveToStorage = (key: string, value: unknown) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`cad-help-${key}`, JSON.stringify(value));
  } catch {
  }
};

const initialState: HelpState = {
  isOpen: false,
  activeTab: 'all',
  searchQuery: '',
  selectedCategory: null,
  favorites: loadFromStorage('favorites', []),
  recentCommands: loadFromStorage('recent', []),
  showOnlyAvailable: false,
  beginnerMode: false,
};

export const [helpState, setHelpState] = createStore(initialState);

export const helpActions = {
  open: () => setHelpState('isOpen', true),
  
  close: () => setHelpState('isOpen', false),
  
  toggle: () => setHelpState('isOpen', (prev) => !prev),
  
  setTab: (tab: HelpTab) => setHelpState('activeTab', tab),
  
  setSearchQuery: (query: string) => setHelpState('searchQuery', query),
  
  setSelectedCategory: (category: string | null) => setHelpState('selectedCategory', category),
  
  toggleShowOnlyAvailable: () => setHelpState('showOnlyAvailable', (prev) => !prev),
  
  toggleBeginnerMode: () => setHelpState('beginnerMode', (prev) => !prev),
  
  addToFavorites: (commandName: string) => {
    setHelpState('favorites', (prev) => {
      const exists = prev.some((f) => f.commandName === commandName);
      if (exists) return prev;
      const newFavorites = [...prev, { commandName, timestamp: Date.now() }];
      saveToStorage('favorites', newFavorites);
      return newFavorites;
    });
  },
  
  removeFromFavorites: (commandName: string) => {
    setHelpState('favorites', (prev) => {
      const newFavorites = prev.filter((f) => f.commandName !== commandName);
      saveToStorage('favorites', newFavorites);
      return newFavorites;
    });
  },
  
  isFavorite: (commandName: string): boolean => {
    return helpState.favorites.some((f) => f.commandName === commandName);
  },
  
  toggleFavorite: (commandName: string) => {
    if (helpActions.isFavorite(commandName)) {
      helpActions.removeFromFavorites(commandName);
    } else {
      helpActions.addToFavorites(commandName);
    }
  },
  
  addToRecent: (commandName: string) => {
    setHelpState('recentCommands', (prev) => {
      const filtered = prev.filter((c) => c.commandName !== commandName);
      const newRecent = [{ commandName, timestamp: Date.now() }, ...filtered].slice(0, 20);
      saveToStorage('recent', newRecent);
      return newRecent;
    });
  },
  
  clearSearch: () => setHelpState('searchQuery', ''),
  
  resetFilters: () => {
    setHelpState('searchQuery', '');
    setHelpState('selectedCategory', null);
    setHelpState('showOnlyAvailable', false);
  },
};
