import { createContext, mergeProps, ParentProps, useContext } from 'solid-js';

export interface UiLabelOptions {
  bracketed: boolean;
  uppercase: boolean;
}

export interface UiContextValue {
  buttonLabelOptions: UiLabelOptions;
  tabLabelOptions: UiLabelOptions;
  fieldLabelOptions: UiLabelOptions;
  formatLabel: (label: string, options?: Partial<UiLabelOptions>) => string;
}

export interface UIProviderProps extends ParentProps {
  buttonLabelOptions?: Partial<UiLabelOptions>;
  tabLabelOptions?: Partial<UiLabelOptions>;
  fieldLabelOptions?: Partial<UiLabelOptions>;
}

const defaultLabelOptions: UiLabelOptions = {
  bracketed: true,
  uppercase: true,
};

const fallbackContext: UiContextValue = {
  buttonLabelOptions: defaultLabelOptions,
  tabLabelOptions: defaultLabelOptions,
  fieldLabelOptions: defaultLabelOptions,
  formatLabel: (label, options) => {
    const merged = {
      ...defaultLabelOptions,
      ...options,
    };

    let result = String(label || '').trim();
    if (merged.uppercase) {
      result = result.toUpperCase();
    }

    if (merged.bracketed && result && !(result.startsWith('[') && result.endsWith(']'))) {
      result = `[${result}]`;
    }

    return result;
  },
};

const UiContext = createContext<UiContextValue>(fallbackContext);

export function UIProvider(props: UIProviderProps) {
  const merged = mergeProps(
    {
      buttonLabelOptions: defaultLabelOptions,
      tabLabelOptions: defaultLabelOptions,
      fieldLabelOptions: defaultLabelOptions,
    },
    props
  );

  const value: UiContextValue = {
    buttonLabelOptions: {
      ...defaultLabelOptions,
      ...merged.buttonLabelOptions,
    },
    tabLabelOptions: {
      ...defaultLabelOptions,
      ...merged.tabLabelOptions,
    },
    fieldLabelOptions: {
      ...defaultLabelOptions,
      ...merged.fieldLabelOptions,
    },
    formatLabel: (label, options) => {
      const finalOptions = {
        ...defaultLabelOptions,
        ...options,
      };

      let result = String(label || '').trim();
      if (finalOptions.uppercase) {
        result = result.toUpperCase();
      }

      if (finalOptions.bracketed && result && !(result.startsWith('[') && result.endsWith(']'))) {
        result = `[${result}]`;
      }

      return result;
    },
  };

  return <UiContext.Provider value={value}>{props.children}</UiContext.Provider>;
}

export function useUIContext() {
  return useContext(UiContext);
}
