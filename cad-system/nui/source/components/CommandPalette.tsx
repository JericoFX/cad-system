
import { For, Show, onMount, onCleanup, createEffect } from 'solid-js';
import { commandPaletteState, commandPaletteActions, setCommandPaletteState, type PaletteItem } from '~/stores/commandPaletteStore';
import { terminalActions } from '~/stores/terminalStore';
import { registry } from '~/commands/registry';
import { helpActions } from '~/stores/helpStore';

export function CommandPalette() {
  let inputRef: HTMLInputElement | undefined;
  let listRef: HTMLDivElement | undefined;

  const executeItem = (item: PaletteItem) => {
    commandPaletteActions.close();
    
    switch (item.type) {
      case 'command':
      case 'action':
        if (item.command) {
          terminalActions.addInput(item.command);
          registry.execute(item.command);
        }
        break;
      case 'gui':
        if (item.modal) {
          terminalActions.setActiveModal(item.modal);
          terminalActions.addLine(`Opening ${item.title}...`, 'system');
        }
        break;
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      commandPaletteActions.toggle();
      return;
    }
    
    if (!commandPaletteState.isOpen) return;
    
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        commandPaletteActions.close();
        break;
      case 'ArrowDown':
        e.preventDefault();
        commandPaletteActions.selectNext();
        scrollSelectedIntoView();
        break;
      case 'ArrowUp':
        e.preventDefault();
        commandPaletteActions.selectPrevious();
        scrollSelectedIntoView();
        break;
      case 'Enter':
        e.preventDefault();
        const selected = commandPaletteActions.getSelectedItem();
        if (selected) {
          executeItem(selected);
        }
        break;
      case 'Tab':
        e.preventDefault();
        if (e.shiftKey) {
          commandPaletteActions.selectPrevious();
        } else {
          commandPaletteActions.selectNext();
        }
        scrollSelectedIntoView();
        break;
    }
  };

  const scrollSelectedIntoView = () => {
    const selectedElement = listRef?.querySelector('.palette-item-selected');
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  };

  createEffect(() => {
    if (commandPaletteState.isOpen && inputRef) {
      setTimeout(() => inputRef?.focus(), 50);
    }
  });

  onMount(() => {
    window.addEventListener('keydown', handleKeyDown);
  });

  onCleanup(() => {
    window.removeEventListener('keydown', handleKeyDown);
  });

  const getItemIcon = (item: PaletteItem): string => {
    if (item.icon) return item.icon;
    switch (item.type) {
      case 'command': return '⌘';
      case 'gui': return '🖥️';
      case 'action': return '⚡';
      default: return '•';
    }
  };

  const getCategoryColor = (category: string): string => {
    const colors: Record<string, string> = {
      'SYSTEM': '#808080',
      'cases': '#00ff00',
      'POLICE': '#0080ff',
      'EMS': '#ff8000',
      'SEARCH': '#ffff00',
      'DISPATCH': '#ff00ff',
      'COMMS': '#00ffff',
      'CIVIL': '#80ff80',
      'NEWS': '#ff8080',
      'LOGISTICS': '#ff80ff',
      'Fines': '#ff0000',
      'evidence': '#80ffff',
      'notes': '#ffff80',
    };
    return colors[category] || '#c0c0c0';
  };

  const openHelp = () => {
    commandPaletteActions.close();
    helpActions.open();
  };

  return (
    <Show when={commandPaletteState.isOpen}>
      <div 
        class="command-palette-overlay"
        onClick={() => commandPaletteActions.close()}
      >
        <div 
          class="command-palette"
          onClick={(e) => e.stopPropagation()}
        >
          <div class="palette-header">
            <span class="palette-icon">⌘</span>
            <input
              ref={inputRef}
              type="text"
              class="palette-input"
              placeholder="Type a command or search..."
              value={commandPaletteState.searchQuery}
              onInput={(e) => commandPaletteActions.setSearchQuery(e.currentTarget.value)}
            />
            <Show when={commandPaletteState.searchQuery}>
              <button 
                class="palette-clear"
                onClick={() => commandPaletteActions.clearSearch()}
              >
                ×
              </button>
            </Show>
            <span class="palette-shortcut">ESC</span>
          </div>

          <div class="palette-list" ref={listRef}>
            <Show
              when={commandPaletteState.filteredItems.length > 0}
              fallback={
                <div class="palette-empty">
                  <div class="palette-empty-icon">🔍</div>
                  <div class="palette-empty-text">No commands found</div>
                  <div class="palette-empty-hint">
                    Try a different search or press <kbd>?</kbd> for help
                  </div>
                </div>
              }
            >
              <For each={commandPaletteState.filteredItems}>
                {(item, index) => (
                  <button
                    class={`palette-item ${index() === commandPaletteState.selectedIndex ? 'palette-item-selected' : ''}`}
                    onClick={() => executeItem(item)}
                    onMouseEnter={() => setCommandPaletteState('selectedIndex', index())}
                  >
                    <span class="palette-item-icon">{getItemIcon(item)}</span>
                    <div class="palette-item-content">
                      <div class="palette-item-title">
                        {item.title}
                        <span 
                          class="palette-item-category"
                          style={{ color: getCategoryColor(item.category) }}
                        >
                          {item.category}
                        </span>
                      </div>
                      <div class="palette-item-subtitle">{item.subtitle}</div>
                    </div>
                    <div class="palette-item-actions">
                      <Show when={item.type === 'command'}>
                        <span class="palette-item-type">CMD</span>
                      </Show>
                      <Show when={item.type === 'gui'}>
                        <span class="palette-item-type">GUI</span>
                      </Show>
                      <Show when={index() === commandPaletteState.selectedIndex}>
                        <span class="palette-item-enter">↵</span>
                      </Show>
                    </div>
                  </button>
                )}
              </For>
            </Show>
          </div>

          <div class="palette-footer">
            <div class="palette-footer-left">
              <span class="palette-hint">
                <kbd>↑↓</kbd> Navigate <kbd>↵</kbd> Select <kbd>ESC</kbd> Close
              </span>
            </div>
            <div class="palette-footer-right">
              <span class="palette-count">
                {commandPaletteState.filteredItems.length} of {commandPaletteState.items.length}
              </span>
              <button class="palette-help-btn" onClick={openHelp}>
                ? Help
              </button>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
}
