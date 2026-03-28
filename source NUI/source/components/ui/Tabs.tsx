import { createContext, JSX, Show, splitProps, useContext, createSignal } from 'solid-js';
import { cn } from '~/utils/cn';
import { useUIContext } from './UIContext';

interface TabsContextValue {
  value: () => string;
  onValueChange: (value: string) => void;
  bracketed: () => boolean;
  uppercase: () => boolean;
}

const TabsContext = createContext<TabsContextValue>();

function useTabsContext(): TabsContextValue {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('Tabs components must be used inside Tabs.Root');
  }
  return context;
}

export interface TabsRootProps extends Omit<JSX.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  value: string;
  onValueChange: (value: string) => void;
  bracketed?: boolean;
  uppercase?: boolean;
}

export function TabsRoot(props: TabsRootProps) {
  const ui = useUIContext();
  const [local, divProps] = splitProps(props, [
    'value',
    'onValueChange',
    'bracketed',
    'uppercase',
    'children',
  ]);

  const contextValue: TabsContextValue = {
    value: () => local.value,
    onValueChange: local.onValueChange,
    bracketed: () => local.bracketed ?? ui.tabLabelOptions.bracketed,
    uppercase: () => local.uppercase ?? ui.tabLabelOptions.uppercase,
  };

  return (
    <TabsContext.Provider value={contextValue}>
      <div {...divProps}>{local.children}</div>
    </TabsContext.Provider>
  );
}

export interface TabsListProps extends JSX.HTMLAttributes<HTMLDivElement> {}

export function TabsList(props: TabsListProps) {
  return (
    <div {...props} class={cn('detail-tabs', props.class)}>
      {props.children}
    </div>
  );
}

export interface TabsTriggerProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
  label?: string;
  badge?: string | number;
  bracketed?: boolean;
  uppercase?: boolean;
}

export function TabsTrigger(props: TabsTriggerProps) {
  const ui = useUIContext();
  const context = useTabsContext();
  const [local, buttonProps] = splitProps(props, [
    'value',
    'label',
    'badge',
    'children',
    'class',
    'bracketed',
    'uppercase',
  ]);

  const active = () => context.value() === local.value;
  const label = () => {
    if (local.children) {
      return local.children;
    }

    const suffix = local.badge !== undefined ? ` (${local.badge})` : '';
    const raw = `${local.label || local.value}${suffix}`;
    return ui.formatLabel(raw, {
      bracketed: local.bracketed ?? context.bracketed(),
      uppercase: local.uppercase ?? context.uppercase(),
    });
  };

  return (
    <button
      type='button'
      {...buttonProps}
      class={cn('tab', active() && 'active', local.class)}
      onClick={() => {
        if (!buttonProps.disabled && local.value !== context.value()) {
          context.onValueChange(local.value);
        }
      }}
    >
      {label()}
    </button>
  );
}

export interface TabsPanelProps extends JSX.HTMLAttributes<HTMLDivElement> {
  value: string;
  forceMount?: boolean;
}

export function TabsPanel(props: TabsPanelProps) {
  const context = useTabsContext();
  const [local, divProps] = splitProps(props, ['value', 'forceMount', 'children']);
  const isVisible = () => context.value() === local.value;

  return (
    <Show when={local.forceMount || isVisible()}>
      <div {...divProps} style={{ ...(divProps.style as JSX.CSSProperties || {}), display: isVisible() ? undefined : 'none' }}>
        {local.children}
      </div>
    </Show>
  );
}

export interface UITabItem {
  value: string;
  label: string;
  disabled?: boolean;
  class?: string;
  badge?: string | number;
}

export interface UITabsProps extends Omit<TabsRootProps, 'children' | 'onValueChange'> {
  items: UITabItem[];
  class?: string;
  tabClass?: string;
  onChange: (value: string) => void;
}

export function UITabs(props: UITabsProps) {
  const [local, rootProps] = splitProps(props, ['items', 'class', 'tabClass', 'onChange']);

  return (
    <TabsRoot {...rootProps} onValueChange={local.onChange}>
      <TabsList class={local.class}>
        {local.items.map((item) => (
          <TabsTrigger
            value={item.value}
            label={item.label}
            badge={item.badge}
            class={cn(local.tabClass, item.class)}
            disabled={item.disabled}
          />
        ))}
      </TabsList>
    </TabsRoot>
  );
}

export function createTabsState<T extends string>(initialValue: T) {
  const [activeTab, setActiveTab] = createSignal<T>(initialValue);

  return {
    activeTab,
    setActiveTab,
    isActive: (value: T) => activeTab() === value,
  };
}

export interface UITabPanelProps extends JSX.HTMLAttributes<HTMLDivElement> {
  when: boolean;
}

export function UITabPanel(props: UITabPanelProps) {
  const [local, divProps] = splitProps(props, ['when', 'children']);
  return <Show when={local.when}><div {...divProps}>{local.children}</div></Show>;
}

export const Tabs = Object.assign(TabsRoot, {
  Root: TabsRoot,
  List: TabsList,
  Trigger: TabsTrigger,
  Panel: TabsPanel,
});

export type TabsComponent = typeof Tabs;
