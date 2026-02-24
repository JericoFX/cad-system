import { type JSX } from 'solid-js';
import { UIProvider } from '~/components/ui/UIContext';
import { ThemeProvider } from '~/utils/ThemeProvider';
import { CADProvider } from './CADProvider';

interface AppProvidersProps {
  children: JSX.Element;
}

export function AppProviders(props: AppProvidersProps) {
  return (
    <ThemeProvider>
      <UIProvider>
        <CADProvider>
          {props.children}
        </CADProvider>
      </UIProvider>
    </ThemeProvider>
  );
}

export { useTheme } from '~/utils/ThemeProvider';
export { useUIContext } from '~/components/ui/UIContext';
export { useCAD, useCADState, useCADIndexes, cadSelectors } from './CADProvider';
