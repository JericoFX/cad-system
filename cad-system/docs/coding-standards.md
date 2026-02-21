# CAD System Coding Standards and Implementation Guidelines

## Overview

This document provides coding standards and implementation guidelines for the CAD system's frontend development, focusing on SolidJS best practices, component architecture, state management, and maintainability.

## 1. SolidJS Best Practices

### Component Structure

```tsx
// Good component structure
import { createSignal, createMemo, onCleanup } from 'solid-js';
import { Button } from '~/components/ui';

interface Props {
  title: string;
  onClose: () => void;
  children?: JSX.Element;
}

export function MyComponent(props: Props) {
  const [count, setCount] = createSignal(0);
  
  // Memoized computations
  const doubleCount = createMemo(() => count() * 2);
  
  // Cleanup effects
  onCleanup(() => {
    // Cleanup logic here
  });
  
  return (
    <div class="my-component">
      <h2>{props.title}</h2>
      <p>Count: {count()}</p>
      <p>Double: {doubleCount()}</p>
      <Button onClick={() => setCount(c => c + 1)}>
        Increment
      </Button>
      {props.children}
    </div>
  );
}
```

### Reactive Patterns

```tsx
// Good reactive patterns
import { createSignal, createMemo, createEffect, on } from 'solid-js';

function UserProfile(props: { userId: string }) {
  // Resource pattern for data fetching
  const [user] = createResource(() => props.userId, fetchUser);
  
  // Memoized computation with explicit dependencies
  const fullName = createMemo(() => {
    const u = user();
    return u ? `${u.firstName} ${u.lastName}` : '';
  }, undefined, { equals: false });
  
  // Effect with explicit dependencies
  createEffect(on(user, (u) => {
    if (u) {
      console.log('User loaded:', u.name);
    }
  }));
  
  return (
    <Show when={!user.loading} fallback={<div>Loading...</div>}>
      <Show when={user()} fallback={<div>User not found</div>}>
        <div>{fullName()}</div>
      </Show>
    </Show>
  );
}
```

### State Management

```tsx
// Good state management patterns
import { createStore, produce } from 'solid-js/store';

interface UserState {
  profile: {
    name: string;
    email: string;
  } | null;
  preferences: {
    theme: 'light' | 'dark';
    notifications: boolean;
  };
}

const [state, setState] = createStore<UserState>({
  profile: null,
  preferences: {
    theme: 'light',
    notifications: true
  }
});

// Batched updates
const updateUserProfile = (profile: UserState['profile']) => {
  setState(produce((s) => {
    s.profile = profile;
    if (profile) {
      s.preferences.notifications = true;
    }
  }));
};

// Selector functions
const selectUserName = () => state.profile?.name || 'Guest';
const selectIsDarkTheme = () => state.preferences.theme === 'dark';
```

## 2. Component Architecture

### Component Composition

```tsx
// Compound components pattern
import { createContext, useContext, ParentProps } from 'solid-js';

interface TabsContextValue {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const TabsContext = createContext<TabsContextValue>();

function useTabs() {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('useTabs must be used within TabsProvider');
  }
  return context;
}

export function Tabs(props: ParentProps<{ defaultValue: string }>) {
  const [activeTab, setActiveTab] = createSignal(props.defaultValue);
  
  return (
    <TabsContext.Provider value={{ activeTab: activeTab(), setActiveTab }}>
      <div class="tabs">{props.children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList(props: ParentProps) {
  return <div class="tabs-list">{props.children}</div>;
}

export function TabsTrigger(props: ParentProps<{ value: string }>) {
  const { activeTab, setActiveTab } = useTabs();
  
  return (
    <button
      classList={{ 
        'tabs-trigger': true, 
        'active': activeTab() === props.value 
      }}
      onClick={() => setActiveTab(props.value)}
    >
      {props.children}
    </button>
  );
}

export function TabsContent(props: ParentProps<{ value: string }>) {
  const { activeTab } = useTabs();
  
  return (
    <Show when={activeTab() === props.value}>
      <div class="tabs-content">{props.children}</div>
    </Show>
  );
}
```

### Render Props Pattern

```tsx
// Render props pattern
import { createSignal, ParentProps } from 'solid-js';

interface ToggleProps {
  children: (props: {
    on: boolean;
    toggle: () => void;
  }) => JSX.Element;
}

export function Toggle(props: ToggleProps) {
  const [on, setOn] = createSignal(false);
  
  const toggle = () => setOn(!on());
  
  return <>{props.children({ on: on(), toggle })}</>;
}

// Usage
<Toggle>
  {({ on, toggle }) => (
    <button onClick={toggle}>
      {on ? 'On' : 'Off'}
    </button>
  )}
</Toggle>
```

## 3. State Management Patterns

### Store Organization

```tsx
// Feature-based store organization
// stores/userStore.ts
import { createStore } from 'solid-js/store';

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface UserState {
  currentUser: User | null;
  users: Record<string, User>;
  loading: boolean;
  error: string | null;
}

const [state, setState] = createStore<UserState>({
  currentUser: null,
  users: {},
  loading: false,
  error: null
});

// Selectors
export const selectors = {
  currentUser: () => state.currentUser,
  userById: (id: string) => state.users[id],
  allUsers: () => Object.values(state.users),
  isLoading: () => state.loading,
  hasError: () => !!state.error
};

// Actions
export const actions = {
  setCurrentUser: (user: User | null) => {
    setState('currentUser', user);
  },
  
  addUser: (user: User) => {
    setState('users', user.id, user);
  },
  
  removeUser: (userId: string) => {
    setState('users', userId, undefined);
  },
  
  setLoading: (loading: boolean) => {
    setState('loading', loading);
  },
  
  setError: (error: string | null) => {
    setState('error', error);
  }
};

export { state };
```

### Normalized State

```tsx
// Normalized state pattern
interface EntityState<T> {
  byId: Record<string, T>;
  allIds: string[];
}

interface NormalizedState {
  persons: EntityState<Person>;
  vehicles: EntityState<Vehicle>;
  cases: EntityState<Case>;
}

const [state, setState] = createStore<NormalizedState>({
  persons: { byId: {}, allIds: [] },
  vehicles: { byId: {}, allIds: [] },
  cases: { byId: {}, allIds: [] }
});

// Selector functions for normalized state
const selectors = {
  getPerson: (id: string) => state.persons.byId[id],
  getAllPersons: () => state.persons.allIds.map(id => state.persons.byId[id]),
  getPersonsByCase: (caseId: string) => 
    state.persons.allIds
      .map(id => state.persons.byId[id])
      .filter(person => person.caseId === caseId)
};
```

## 4. Error Handling

### Error Boundaries

```tsx
// Error boundary component
import { ErrorBoundary, createSignal, ParentProps } from 'solid-js';

interface ErrorBoundaryProps extends ParentProps {
  fallback: (error: Error, reset: () => void) => JSX.Element;
}

export function AppErrorBoundary(props: ErrorBoundaryProps) {
  const [error, setError] = createSignal<Error | null>(null);
  const [info, setInfo] = createSignal<{ componentStack?: string } | null>(null);
  
  const resetError = () => {
    setError(null);
    setInfo(null);
  };
  
  return (
    <ErrorBoundary
      fallback={(err, reset) => {
        setError(err);
        // Log error to monitoring service
        console.error('Error caught by boundary:', err);
        return props.fallback(err, resetError);
      }}
    >
      {props.children}
    </ErrorBoundary>
  );
}

// Usage
<AppErrorBoundary 
  fallback={(error, reset) => (
    <div class="error-fallback">
      <h2>Something went wrong</h2>
      <p>{error.message}</p>
      <button onClick={reset}>Try again</button>
    </div>
  )}
>
  <MyComponent />
</AppErrorBoundary>
```

### Resource Error Handling

```tsx
// Resource error handling
import { createResource, ErrorBoundary } from 'solid-js';

function DataComponent(props: { id: string }) {
  const [data] = createResource(() => props.id, fetchData);
  
  return (
    <ErrorBoundary fallback={(err) => (
      <div class="error-message">
        Failed to load data: {err.message}
        <button onClick={() => data.refetch()}>Retry</button>
      </div>
    )}>
      <Show when={!data.loading} fallback={<div>Loading...</div>}>
        <Show when={data()} fallback={<div>No data available</div>}>
          <div>{/* Render data */}</div>
        </Show>
      </Show>
    </ErrorBoundary>
  );
}
```

## 5. Accessibility

### ARIA Implementation

```tsx
// Accessible modal component
import { createSignal, onMount, onCleanup } from 'solid-js';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: JSX.Element;
}

export function AccessibleModal(props: ModalProps) {
  const [modalRef, setModalRef] = createSignal<HTMLElement | null>(null);
  
  onMount(() => {
    const modal = modalRef();
    if (modal && props.isOpen) {
      // Focus trap
      const focusableElements = modal.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      
      if (focusableElements.length > 0) {
        (focusableElements[0] as HTMLElement).focus();
      }
      
      // Escape key handling
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          props.onClose();
        }
      };
      
      document.addEventListener('keydown', handleEscape);
      onCleanup(() => {
        document.removeEventListener('keydown', handleEscape);
      });
    }
  });
  
  return (
    <Show when={props.isOpen}>
      <div 
        class="modal-overlay" 
        onClick={props.onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div 
          ref={setModalRef}
          class="modal-content"
          onClick={(e) => e.stopPropagation()}
          role="document"
        >
          <div class="modal-header">
            <h2 id="modal-title">{props.title}</h2>
            <button 
              class="modal-close"
              onClick={props.onClose}
              aria-label="Close modal"
            >
              ×
            </button>
          </div>
          <div class="modal-body">
            {props.children}
          </div>
        </div>
      </div>
    </Show>
  );
}
```

## 6. Performance Optimization

### Virtual Scrolling

```tsx
// Virtual scrolling implementation
import { createSignal, For } from 'solid-js';
import { createVirtualizer } from '@tanstack/solid-virtual';

interface VirtualListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => JSX.Element;
  itemHeight: number;
}

export function VirtualList<T>(props: VirtualListProps<T>) {
  const [parentRef, setParentRef] = createSignal<HTMLDivElement | null>(null);
  
  const virtualizer = createVirtualizer({
    count: props.items.length,
    getScrollElement: () => parentRef(),
    estimateSize: () => props.itemHeight,
    overscan: 5,
  });
  
  const items = virtualizer.getVirtualItems();
  
  return (
    <div 
      ref={setParentRef}
      class="virtual-list"
      style={{ height: '400px', overflow: 'auto' }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        <For each={items}>
          {(virtualItem) => (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              {props.renderItem(props.items[virtualItem.index], virtualItem.index)}
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
```

## 7. Testing Guidelines

### Unit Testing

```tsx
// Unit test example
import { render, screen, fireEvent } from 'solid-testing-library';
import { createRoot } from 'solid-js';
import { describe, it, expect, vi } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('renders with correct text', () => {
    const { container } = render(() => <Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });
  
  it('calls onClick when clicked', () => {
    const handleClick = vi.fn();
    render(() => <Button onClick={handleClick}>Click me</Button>);
    
    fireEvent.click(screen.getByText('Click me'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
  
  it('is disabled when disabled prop is true', () => {
    render(() => <Button disabled>Click me</Button>);
    expect(screen.getByText('Click me')).toBeDisabled();
  });
});
```

### Store Testing

```tsx
// Store testing example
import { describe, it, expect, beforeEach } from 'vitest';
import { state, actions, selectors } from './userStore';

describe('userStore', () => {
  beforeEach(() => {
    // Reset store state
    actions.setCurrentUser(null);
  });
  
  describe('actions', () => {
    it('sets current user', () => {
      const user = { id: '1', name: 'John', email: 'john@example.com', role: 'user' };
      actions.setCurrentUser(user);
      expect(selectors.currentUser()).toEqual(user);
    });
  });
  
  describe('selectors', () => {
    it('returns guest name when no user', () => {
      expect(selectors.currentUser()).toBeNull();
    });
  });
});
```

## 8. Code Organization

### File Structure

```
src/
├── components/
│   ├── ui/              # Reusable UI components
│   ├── modals/          # Modal components
│   ├── forms/           # Form components
│   └── layout/          # Layout components
├── stores/              # State management
├── hooks/               # Custom hooks
├── utils/               # Utility functions
├── services/            # API services
├── styles/              # CSS/SCSS files
└── types/               # TypeScript types
```

### Component Naming

- Use PascalCase for component names
- Use descriptive names that indicate purpose
- Prefix with feature name for larger components
- Use `index.ts` for component directories

```tsx
// Good naming
components/
├── Button/
│   ├── Button.tsx
│   ├── Button.types.ts
│   └── index.ts
├── PersonSearch/
│   ├── PersonSearch.tsx
│   ├── PersonSearch.types.ts
│   ├── PersonResults.tsx
│   └── index.ts
```

## 9. TypeScript Guidelines

### Type Definitions

```tsx
// Good type definitions
interface Person {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  ssn: string;
}

interface Case {
  id: string;
  title: string;
  description: string;
  status: 'open' | 'closed' | 'pending';
  priority: 1 | 2 | 3;
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
}

// Union types for related entities
type Evidence = PhotoEvidence | DocumentEvidence | PhysicalEvidence;

interface BaseEvidence {
  id: string;
  caseId: string;
  createdAt: string;
  createdBy: string;
}

interface PhotoEvidence extends BaseEvidence {
  type: 'photo';
  url: string;
  caption?: string;
}

interface DocumentEvidence extends BaseEvidence {
  type: 'document';
  title: string;
  content: string;
}

interface PhysicalEvidence extends BaseEvidence {
  type: 'physical';
  description: string;
  location: string;
}
```

### Generic Components

```tsx
// Generic component with proper typing
import { ParentProps } from 'solid-js';

interface DataListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => JSX.Element;
  getKey: (item: T) => string | number;
  emptyState?: JSX.Element;
}

export function DataList<T>(props: DataListProps<T> & ParentProps) {
  return (
    <div class="data-list">
      {props.children}
      <Show when={props.items.length > 0} fallback={props.emptyState}>
        <For each={props.items} fallback={props.emptyState}>
          {(item, index) => (
            <div key={props.getKey(item)}>
              {props.renderItem(item, index())}
            </div>
          )}
        </For>
      </Show>
    </div>
  );
}
```

## 10. Performance Monitoring

### Performance Tracking

```tsx
// Performance monitoring utilities
import { createEffect } from 'solid-js';

// Performance monitoring hook
export function usePerformanceMonitor(name: string) {
  const start = performance.now();
  
  createEffect(() => {
    const end = performance.now();
    const duration = end - start;
    
    if (duration > 16) { // More than 1 frame
      console.warn(`Component ${name} took ${duration.toFixed(2)}ms to render`);
    }
  });
}

// Usage
function MyComponent() {
  usePerformanceMonitor('MyComponent');
  
  return <div>My Component</div>;
}
```

This coding standards document provides comprehensive guidelines for developing and maintaining the CAD system's frontend codebase, ensuring consistency, performance, and maintainability across all components.
