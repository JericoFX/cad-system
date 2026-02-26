
import { For, Show, createSignal, createMemo } from 'solid-js';
import { dockState, dockActions, type DockItem } from '~/stores/dockStore';
import { terminalActions } from '~/stores/terminalStore';
import { registry } from '~/commands/registry';
import { helpActions } from '~/stores/helpStore';
import { uiPrefsState, uiPrefsActions } from '~/stores/uiPreferencesStore';
import { userState } from '~/stores/userStore';
import { featureActions } from '~/stores/featureStore';
import { CONFIG } from '~/config';
import { NotificationCenter } from './NotificationCenter';

export function DockLauncher() {
  const [hoveredItem, setHoveredItem] = createSignal<string | null>(null);
  
  const showLabels = () => uiPrefsState.showDockLabels || uiPrefsState.dockExpanded || uiPrefsState.navigationMode === 'dock';
  
  const isVisible = createMemo(() => {
    if (!dockState.isVisible) return false;
    return uiPrefsActions.shouldShowDock();
  });
  
  const isCollapsed = createMemo(() => {
    return uiPrefsState.navigationMode === 'terminal' && uiPrefsState.dockCollapsedInTerminalMode && !uiPrefsState.dockExpanded;
  });

  const visibleItems = createMemo(() => {
    if (CONFIG.USE_MOCK_DATA && CONFIG.MOCK_BYPASS_ROLE_GUARDS) {
      return dockState.items;
    }

    const role = userState.currentUser?.role;
    if (!role) {
      return [];
    }

    return dockState.items.filter((item) => {
      if (item.modal && !featureActions.isModalEnabled(item.modal)) {
        return false;
      }

      if (!item.roles || item.roles.length === 0) {
        return true;
      }
      return item.roles.includes(role);
    });
  });

  const handleItemClick = (item: DockItem) => {
    dockActions.setActiveItem(item.id);
    
    if (item.id === 'help') {
      helpActions.open();
    } else if (item.modal) {
      terminalActions.setActiveModal(item.modal);
      terminalActions.addLine(`Opening ${item.name}...`, 'system');
    } else if (item.command) {
      registry.execute(item.command);
    }
  };

  const getItemClass = (item: DockItem) => {
    const classes = ['dock-item'];
    if (dockState.activeItem === item.id) {
      classes.push('active');
    }
    if (hoveredItem() === item.id) {
      classes.push('hovered');
    }
    return classes.join(' ');
  };

  return (
    <Show when={isVisible()}>
      <div 
        class={`dock-launcher ${dockState.position} ${uiPrefsState.dockExpanded ? 'expanded' : ''} ${isCollapsed() ? 'collapsed' : ''}`}
        onMouseEnter={() => uiPrefsActions.setShowDockLabels(true)}
        onMouseLeave={() => uiPrefsActions.setShowDockLabels(false)}
        onClick={() => isCollapsed() && uiPrefsActions.toggleDockExpanded()}
      >
        <div class="dock-container">
          <For each={visibleItems()}>
            {(item) => (
              <button
                class={getItemClass(item)}
                onClick={() => handleItemClick(item)}
                onMouseEnter={() => setHoveredItem(item.id)}
                onMouseLeave={() => setHoveredItem(null)}
                title={`${item.tooltip}${item.shortcut ? ` (${item.shortcut})` : ''}`}
              >
                <span class="dock-icon">{item.icon}</span>
                <Show when={showLabels()}>
                  <span class="dock-label">{item.name}</span>
                </Show>
              </button>
            )}
          </For>
          
          <div class="dock-divider" />
          
          <NotificationCenter mode="dock" />
        </div>
      </div>
    </Show>
  );
}
