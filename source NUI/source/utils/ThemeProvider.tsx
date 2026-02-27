import { createContext, useContext, onMount, onCleanup, createSignal, createEffect, type ParentComponent } from 'solid-js';
import type { ThemeName } from './theme';
import { applyTheme, getCurrentTheme, getThemeClasses, initTheme } from './theme';

export interface ThemeContextValue {
  currentTheme: () => ThemeName;
  setTheme: (theme: ThemeName) => void;
  themeClasses: () => ReturnType<typeof getThemeClasses>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export const ThemeProvider: ParentComponent = (props) => {
  const [currentTheme, setCurrentTheme] = createSignal<ThemeName>('dos');

  onMount(() => {
    initTheme();
    setCurrentTheme(getCurrentTheme());
  });

  createEffect(() => {
    const theme = currentTheme();
    applyTheme(theme);
  });

  const handleThemeChange = (e: Event) => {
    const customEvent = e as CustomEvent<ThemeName>;
    if (customEvent.detail !== currentTheme()) {
      setCurrentTheme(customEvent.detail);
    }
  };

  onMount(() => {
    window.addEventListener('themechange', handleThemeChange);
  });

  onCleanup(() => {
    window.removeEventListener('themechange', handleThemeChange);
  });

  const setTheme = (theme: ThemeName) => {
    setCurrentTheme(theme);
  };

  const themeClasses = () => getThemeClasses(currentTheme());

  const value: ThemeContextValue = {
    currentTheme,
    setTheme,
    themeClasses,
  };

  return (
    <ThemeContext.Provider value={value}>
      {props.children}
    </ThemeContext.Provider>
  );
};
