import {
  mergeProps,
  splitProps,
  createSignal,
  createEffect,
  For,
  Show,
  createMemo
} from 'solid-js';
import { cn } from '../utils/cn';
import { useTheme } from '../utils/ThemeProvider';
import type { FileExplorerProps, FileItem } from './FileExplorer.types';

const defaultClassNames = {
  container: 'tui-file-explorer tui-window',
  addressBar: 'tui-explorer-address',
  navButtons: 'tui-explorer-nav',
  navButton: 'tui-explorer-nav-btn tui-button',
  breadcrumb: 'tui-explorer-breadcrumb',
  breadcrumbItem: 'tui-explorer-breadcrumb-item',
  breadcrumbSeparator: 'tui-explorer-breadcrumb-sep',
  searchBar: 'tui-explorer-search',
  searchContainer: 'tui-explorer-search-container',
  searchInput: 'tui-input tui-explorer-search-input',
  searchClear: 'tui-button tui-explorer-search-clear',
  content: 'tui-explorer-content',
  iconsView: 'tui-explorer-icons',
  item: 'tui-explorer-item',
  itemSelected: 'tui-explorer-item-selected',
  itemIcon: 'tui-explorer-item-icon',
  itemName: 'tui-explorer-item-name',
  detailsView: 'tui-explorer-details',
  detailsHeader: 'tui-explorer-details-header',
  detailsCol: 'tui-explorer-details-col',
  detailsContent: 'tui-explorer-details-content',
  detailsRow: 'tui-explorer-details-row',
  detailsRowSelected: 'tui-explorer-details-row-selected',
  detailsCell: 'tui-explorer-details-cell',
  detailsIcon: 'tui-explorer-details-icon',
  statusBar: 'tui-explorer-status'
} as const;

type ClassSlots = keyof typeof defaultClassNames;

export function createFileExplorerState(props: FileExplorerProps) {
  const merged = mergeProps(
    {
      width: '100%',
      height: '400px',
      viewMode: 'icons' as const,
      showHidden: false,
      showSearch: true,
      searchPlaceholder: 'Search files and folders...',
      currentPath: '',
      namespace: 'tui',
      color: ''
    },
    props
  );

  const [local, others] = splitProps(merged, [
    'data',
    'currentPath',
    'width',
    'height',
    'viewMode',
    'showHidden',
    'showSearch',
    'searchPlaceholder',
    'onNavigate',
    'onFileSelect',
    'onFileOpen',
    'onSearchChange',
    'class',
    'classNames',
    'namespace',
    'iconResolver',
    'color'
  ]);

  const [fileData, setFileData] = createSignal<FileItem[]>(local.data || []);
  const [selectedItems, setSelectedItems] = createSignal<string[]>([]);
  const [lastClickTime, setLastClickTime] = createSignal<number>(0);
  const [lastClickedItem, setLastClickedItem] = createSignal<string>('');
  const [history, setHistory] = createSignal<string[]>([]);
  const [historyIndex, setHistoryIndex] = createSignal<number>(-1);
  const [searchTerm, setSearchTerm] = createSignal<string>('');
  let lastInternalPath: string | null = null;

  const scrollbarClass = createMemo(() => {
    try {
      const theme = useTheme();
      return theme.themeClasses().scrollbar;
    } catch {
      return 'tui-scroll-white';
    }
  });

  const classFor = (slot: ClassSlots, extra?: string) => {
    const baseClass = cn(defaultClassNames[slot], local.classNames?.[slot], extra);
    if (slot === 'content') {
      return cn(baseClass, scrollbarClass());
    }
    return baseClass;
  };

  createEffect(() => {
    if (local.data) {
      setFileData(local.data);
    }
  });

  createEffect(() => {
    const path = local.currentPath || '';

    setSelectedItems([]);
    setLastClickedItem('');
    setLastClickTime(0);

    if (lastInternalPath !== null) {
      if (path === lastInternalPath) {
        lastInternalPath = null;
        return;
      }
      lastInternalPath = null;
    }

    setHistory((prev) => {
      if (prev[prev.length - 1] === path) return prev;
      const currentIndex = historyIndex();
      const nextHistory = prev.slice(0, currentIndex + 1);
      nextHistory.push(path);
      setHistoryIndex(nextHistory.length - 1);
      return nextHistory;
    });
  });

  const addItem = (item: FileItem) => {
    const resolvedPath = item.path ?? (local.currentPath || '');
    setFileData((prev) => [...prev, { ...item, path: resolvedPath }]);
  };

  const addFolder = (name: string, options?: { path?: string; modified?: Date; icon?: string }) => {
    addItem({
      name,
      type: 'folder',
      path: options?.path,
      modified: options?.modified,
      icon: options?.icon
    });
  };

  const addFile = (
    name: string,
    options?: { path?: string; modified?: Date; size?: number; icon?: string }
  ) => {
    addItem({
      name,
      type: 'file',
      path: options?.path,
      modified: options?.modified,
      size: options?.size,
      icon: options?.icon
    });
  };

  const canGoBack = () => historyIndex() > 0;
  const canGoForward = () => historyIndex() < history().length - 1;

  const resetSelectionState = () => {
    setSelectedItems([]);
    setLastClickedItem('');
    setLastClickTime(0);
  };

  const navigateBack = () => {
    if (canGoBack()) {
      resetSelectionState();
      const newIndex = historyIndex() - 1;
      setHistoryIndex(newIndex);
      const path = history()[newIndex];
      lastInternalPath = path;
      local.onNavigate?.(path, { name: path.split('/').pop() || '', type: 'folder', path });
    }
  };

  const navigateForward = () => {
    if (canGoForward()) {
      resetSelectionState();
      const newIndex = historyIndex() + 1;
      setHistoryIndex(newIndex);
      const path = history()[newIndex];
      lastInternalPath = path;
      local.onNavigate?.(path, { name: path.split('/').pop() || '', type: 'folder', path });
    }
  };

  const navigateUp = () => {
    const currentPath = local.currentPath || '';
    if (currentPath) {
      const parentPath = currentPath.split('/').slice(0, -1).join('/');
      resetSelectionState();
      navigateToPath(parentPath);
    }
  };

  const navigateToPath = (newPath: string) => {
    const currentPath = local.currentPath || '';
    if (newPath !== currentPath) {
      resetSelectionState();
      const currentHistory = history();
      const currentIndex = historyIndex();

      const newHistory = currentHistory.slice(0, currentIndex + 1);
      newHistory.push(newPath);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);

      lastInternalPath = newPath;
      local.onNavigate?.(newPath, { name: newPath.split('/').pop() || '', type: 'folder', path: newPath });
    }
  };

  const handleItemClick = (item: FileItem) => {
    const clickTime = Date.now();
    const isDoubleClick = lastClickedItem() === item.name && clickTime - lastClickTime() < 300;

    setLastClickTime(clickTime);
    setLastClickedItem(item.name);

    if (isDoubleClick) {
      handleItemOpen(item);
    } else {
      setSelectedItems([item.name]);
      local.onFileSelect?.(item);
    }
  };

  const handleItemOpen = (item: FileItem) => {
    if (item.type === 'folder' || item.type === 'drive') {
      const newPath = item.path ? `${item.path}/${item.name}` : item.name;
      navigateToPath(newPath);
    }
    local.onFileOpen?.(item);
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    local.onSearchChange?.(value);
  };

  const formatSize = (size?: number) => {
    if (!size) return '';
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = size;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex += 1;
    }
    return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  };

  const formatDate = (date?: Date | string) => {
    if (!date) return '';
    const value = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat('default', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(value);
  };

  const iconFor = (item: FileItem) => local.iconResolver?.(item) ?? (item.type === 'folder' ? 'DIR' : 'FILE');

  const filteredItems = createMemo(() => {
    const query = searchTerm().trim().toLowerCase();
    const currentPath = local.currentPath || '';
    return fileData().filter((item) => {
      if (!local.showHidden && item.name.startsWith('.')) return false;
      if (item.path && item.path !== currentPath) return false;
      if (!query) return true;
      return item.name.toLowerCase().includes(query);
    });
  });

  return {
    get data() {
      return filteredItems();
    },
    get selectedItems() {
      return selectedItems();
    },
    get searchTerm() {
      return searchTerm();
    },
    get canGoBack() {
      return canGoBack();
    },
    get canGoForward() {
      return canGoForward();
    },
    addFile,
    addFolder,
    navigateBack,
    navigateForward,
    navigateUp,
    navigateToPath,
    handleItemClick,
    handleItemOpen,
    handleSearchChange,
    formatSize,
    formatDate,
    iconFor,
    classFor,
    class: local.class,
    width: local.width,
    height: local.height,
    viewMode: local.viewMode,
    showSearch: local.showSearch,
    searchPlaceholder: local.searchPlaceholder,
    currentPath: local.currentPath,
    namespace: local.namespace,
    color: local.color,
    others
  };
}

export function FileExplorer(props: FileExplorerProps) {
  const state = createFileExplorerState(props);

  return (
    <div
      class={state.classFor('container', cn(state.class, state.color))}
      style={{ width: state.width, height: state.height }}
      data-namespace={state.namespace}
      {...state.others}
    >
      <div class={state.classFor('addressBar')}>
        <div class={state.classFor('navButtons')}>
          <button
            type="button"
            class={state.classFor('navButton')}
            disabled={!state.canGoBack}
            onClick={state.navigateBack}
          >
            Back
          </button>
          <button
            type="button"
            class={state.classFor('navButton')}
            disabled={!state.canGoForward}
            onClick={state.navigateForward}
          >
            Forward
          </button>
          <button
            type="button"
            class={state.classFor('navButton')}
            disabled={!state.currentPath}
            onClick={state.navigateUp}
          >
            Up
          </button>
        </div>
        <div class={state.classFor('breadcrumb')}>
          <For each={(state.currentPath || '').split('/').filter(Boolean)}>
            {(segment, index) => (
              <>
                <button
                  type="button"
                  class={state.classFor('breadcrumbItem')}
                  onClick={() =>
                    state.navigateToPath((state.currentPath || '').split('/').slice(0, index() + 1).join('/'))
                  }
                >
                  {segment}
                </button>
                <span class={state.classFor('breadcrumbSeparator')}>/</span>
              </>
            )}
          </For>
        </div>
      </div>

      <Show when={state.showSearch}>
        <div class={state.classFor('searchBar')}>
          <div class={state.classFor('searchContainer')}>
            <input
              class={state.classFor('searchInput')}
              placeholder={state.searchPlaceholder}
              value={state.searchTerm}
              onInput={(event) => state.handleSearchChange(event.currentTarget.value)}
            />
            <Show when={state.searchTerm}>
              <button
                type="button"
                class={state.classFor('searchClear')}
                onClick={() => state.handleSearchChange('')}
              >
                Clear
              </button>
            </Show>
          </div>
        </div>
      </Show>

      <div class={state.classFor('content')}>
        <Show when={state.viewMode === 'details'} fallback={
          <div class={state.classFor('iconsView')}>
            <For each={state.data}>
              {(item) => (
                <div
                  class={state.classFor(
                    'item',
                    state.selectedItems.includes(item.name) ? state.classFor('itemSelected') : undefined
                  )}
                  onClick={() => state.handleItemClick(item)}
                  onDblClick={() => state.handleItemOpen(item)}
                >
                  <div class={state.classFor('itemIcon')}>{state.iconFor(item)}</div>
                  <div class={state.classFor('itemName')}>{item.name}</div>
                </div>
              )}
            </For>
          </div>
        }>
          <div class={state.classFor('detailsView')}>
            <div class={state.classFor('detailsHeader')}>
              <span class={state.classFor('detailsCol')}>Name</span>
              <span class={state.classFor('detailsCol')}>Type</span>
              <span class={state.classFor('detailsCol')}>Size</span>
              <span class={state.classFor('detailsCol')}>Modified</span>
            </div>
            <div class={state.classFor('detailsContent')}>
              <For each={state.data}>
                {(item) => (
                  <div
                    class={state.classFor(
                      'detailsRow',
                      state.selectedItems.includes(item.name)
                        ? state.classFor('detailsRowSelected')
                        : undefined
                    )}
                    onClick={() => state.handleItemClick(item)}
                    onDblClick={() => state.handleItemOpen(item)}
                  >
                    <span class={state.classFor('detailsCell')}>
                      <span class={state.classFor('detailsIcon')}>{state.iconFor(item)}</span>
                      {item.name}
                    </span>
                    <span class={state.classFor('detailsCell')}>{item.type}</span>
                    <span class={state.classFor('detailsCell')}>{state.formatSize(item.size)}</span>
                    <span class={state.classFor('detailsCell')}>{state.formatDate(item.modified)}</span>
                  </div>
                )}
              </For>
            </div>
          </div>
        </Show>
      </div>

      <div class={state.classFor('statusBar')}>
        <span>{state.data.length} items</span>
        <span>{state.currentPath || 'Root'}</span>
      </div>
    </div>
  );
}
