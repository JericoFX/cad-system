
import { For, Show, createMemo, onMount, onCleanup } from 'solid-js';
import { helpState, helpActions, type HelpTab } from '~/stores/helpStore';
import { registry } from '~/commands/registry';
import { terminalActions } from '~/stores/terminalStore';
import type { Command } from '~/commands/registry';

interface CommandWithGUI {
  command: Command;
  hasGUI: boolean;
  guiModal?: string;
}

const COMMAND_TO_GUI_MAP: Record<string, string> = {
  'case': 'CASE_CREATOR',
  'evidence': 'EVIDENCE',
  'forensics': 'FORENSIC_COLLECTION',
  'addevidence': 'UPLOAD',
  'notes': 'NOTES',
  'notegui': 'NOTES_FILE',
  'dispatch': 'DISPATCH_PANEL',
  'search-person': 'PERSON_SEARCH',
  'person': 'PERSON_SNAPSHOT',
  'search-vehicle': 'VEHICLE_SEARCH',
  'arrest': 'ARREST_WIZARD',
  'police': 'POLICE_DASHBOARD',
  'ems': 'EMS_DASHBOARD',
  'bolo': 'BOLO_MANAGER',
  'bolo-gui': 'BOLO_MANAGER',
  'warrant': 'BOLO_MANAGER',
  'fine': 'FINE_MANAGER',
  'license': 'LICENSE_MANAGER',
  'property': 'PROPERTY_MANAGER',
  'fleet': 'FLEET_MANAGER',
  'radio': 'RADIO_PANEL',
  'map': 'MAP',
};

const COMMAND_DEPENDENCIES: Record<string, { requires: string; message: string }> = {
  'addnote': { requires: 'Active Case', message: 'Requires a case to be selected first' },
  'addevidence': { requires: 'Active Case', message: 'Evidence will be staged for the current case' },
  'task add': { requires: 'Active Case', message: 'Requires a case to be selected first' },
  'notes': { requires: 'Active Case', message: 'Works best with an active case' },
  'evidence': { requires: 'Active Case', message: 'Shows evidence for current case' },
  'case view': { requires: 'Case ID', message: 'Provide a case ID or use with active case' },
  'case close': { requires: 'Active Case', message: 'Requires a case to be selected first' },
};

const CATEGORIES: Record<string, { label: string; color: string }> = {
  'SYSTEM': { label: 'System', color: '#808080' },
  'cases': { label: 'Cases', color: '#00ff00' },
  'POLICE': { label: 'Police', color: '#0080ff' },
  'EMS': { label: 'EMS', color: '#ff8000' },
  'SEARCH': { label: 'Search', color: '#ffff00' },
  'DISPATCH': { label: 'Dispatch', color: '#ff00ff' },
  'COMMS': { label: 'Comms', color: '#00ffff' },
  'CIVIL': { label: 'Civil', color: '#80ff80' },
  'NEWS': { label: 'News', color: '#ff8080' },
  'LOGISTICS': { label: 'Logistics', color: '#ff80ff' },
  'Fines': { label: 'Fines', color: '#ff0000' },
  'evidence': { label: 'Evidence', color: '#80ffff' },
  'notes': { label: 'Notes', color: '#ffff80' },
};

export function HelpDrawer() {
  let searchInputRef: HTMLInputElement | undefined;

  const enrichedCommands = createMemo<CommandWithGUI[]>(() => {
    return registry.getAll().map((cmd) => ({
      command: cmd,
      hasGUI: cmd.name in COMMAND_TO_GUI_MAP || Object.keys(COMMAND_TO_GUI_MAP).some(key => cmd.name.startsWith(key)),
      guiModal: COMMAND_TO_GUI_MAP[cmd.name],
    }));
  });

  const filteredCommands = createMemo(() => {
    let commands = enrichedCommands();
    const query = helpState.searchQuery.toLowerCase();

    if (query) {
      commands = commands.filter((item) => {
        const cmd = item.command;
        return (
          cmd.name.toLowerCase().includes(query) ||
          cmd.description.toLowerCase().includes(query) ||
          cmd.aliases?.some((a) => a.toLowerCase().includes(query))
        );
      });
    }

    if (helpState.selectedCategory) {
      commands = commands.filter((item) => {
        const category = (item.command as any).category;
        return category === helpState.selectedCategory;
      });
    }

    switch (helpState.activeTab) {
      case 'favorites':
        commands = commands.filter((item) => helpActions.isFavorite(item.command.name));
        break;
      case 'recent':
        const recentNames = helpState.recentCommands.map((r) => r.commandName);
        commands = commands.sort((a, b) => {
          const idxA = recentNames.indexOf(a.command.name);
          const idxB = recentNames.indexOf(b.command.name);
          if (idxA === -1 && idxB === -1) return 0;
          if (idxA === -1) return 1;
          if (idxB === -1) return -1;
          return idxA - idxB;
        });
        break;
    }

    return commands;
  });

  const categories = createMemo(() => {
    const cats = new Set<string>();
    registry.getAll().forEach((cmd) => {
      const cat = (cmd as any).category;
      if (cat) cats.add(cat);
    });
    return Array.from(cats).sort();
  });

  const runCommand = (commandName: string) => {
    terminalActions.addInput(commandName);
    registry.execute(commandName);
    helpActions.addToRecent(commandName);
    helpActions.close();
  };

  const copyCommand = (commandName: string) => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(commandName);
      terminalActions.addLine(`Copied: ${commandName}`, 'system');
    }
  };

  const openGUI = (modalName: string | undefined) => {
    if (modalName) {
      terminalActions.setActiveModal(modalName);
      helpActions.close();
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'F1') {
      e.preventDefault();
      helpActions.toggle();
    } else if (e.key === '/' && helpState.isOpen) {
      e.preventDefault();
      searchInputRef?.focus();
    } else if (e.key === 'Escape' && helpState.isOpen) {
      e.preventDefault();
      helpActions.close();
    }
  };

  onMount(() => {
    window.addEventListener('keydown', handleKeyDown);
  });

  onCleanup(() => {
    window.removeEventListener('keydown', handleKeyDown);
  });

  const TabButton = (props: { tab: HelpTab; label: string }) => (
    <button
      class={`help-tab ${helpState.activeTab === props.tab ? 'active' : ''}`}
      onClick={() => helpActions.setTab(props.tab)}
    >
      {props.label}
    </button>
  );

  return (
    <Show when={helpState.isOpen}>
      <div class="help-drawer-overlay" onClick={() => helpActions.close()}>
        <div
          class="help-drawer"
          onClick={(e) => e.stopPropagation()}
        >
          <div class="help-drawer-header">
            <h2 class="help-title">COMMAND GUIDE</h2>
            <button class="help-close-btn" onClick={() => helpActions.close()}>
              [ESC]
            </button>
          </div>

          <div class="help-search-bar">
            <span class="help-search-icon">/</span>
            <input
              ref={searchInputRef}
              type="text"
              class="help-search-input"
              placeholder="Search command or keyword..."
              value={helpState.searchQuery}
              onInput={(e) => helpActions.setSearchQuery(e.currentTarget.value)}
            />
            <Show when={helpState.searchQuery}>
              <button
                class="help-search-clear"
                onClick={() => helpActions.clearSearch()}
              >
                ×
              </button>
            </Show>
          </div>

          <div class="help-toggles">
            <label class="help-toggle">
              <input
                type="checkbox"
                checked={helpState.showOnlyAvailable}
                onChange={() => helpActions.toggleShowOnlyAvailable()}
              />
              <span>Available only</span>
            </label>
            <label class="help-toggle">
              <input
                type="checkbox"
                checked={helpState.beginnerMode}
                onChange={() => helpActions.toggleBeginnerMode()}
              />
              <span>Beginner mode</span>
            </label>
          </div>

          <div class="help-tabs">
            <TabButton tab="all" label="ALL" />
            <TabButton tab="favorites" label={`FAVS (${helpState.favorites.length})`} />
            <TabButton tab="byRole" label="BY ROLE" />
            <TabButton tab="recent" label="RECENT" />
          </div>

          <Show when={helpState.activeTab === 'all' || helpState.activeTab === 'byRole'}>
            <div class="help-categories">
              <button
                class={`help-category ${!helpState.selectedCategory ? 'active' : ''}`}
                onClick={() => helpActions.setSelectedCategory(null)}
              >
                ALL
              </button>
              <For each={categories()}>
                {(cat) => (
                  <button
                    class={`help-category ${helpState.selectedCategory === cat ? 'active' : ''}`}
                    onClick={() => helpActions.setSelectedCategory(cat)}
                    style={{ 'border-color': CATEGORIES[cat]?.color || '#c0c0c0' }}
                  >
                    {CATEGORIES[cat]?.label || cat}
                  </button>
                )}
              </For>
            </div>
          </Show>

          <div class="help-commands-list">
            <Show
              when={filteredCommands().length > 0}
              fallback={
                <div class="help-empty">
                  No commands found. Try a different search.
                </div>
              }
            >
              <For each={filteredCommands()}>
                {(item) => {
                  const cmd = item.command;
                  const category = (cmd as any).category || 'SYSTEM';
                  const catInfo = CATEGORIES[category] || CATEGORIES['SYSTEM'];
                  const isFav = helpActions.isFavorite(cmd.name);

                  return (
                    <div class="help-command-card">
                      <div class="help-command-header">
                        <div class="help-command-main">
                          <span class="help-command-name">{cmd.name}</span>
                          <Show when={cmd.aliases && cmd.aliases.length > 0}>
                            <span class="help-command-aliases">
                              ({cmd.aliases?.join(', ')})
                            </span>
                          </Show>
                          <span
                            class="help-category-badge"
                            style={{ color: catInfo.color }}
                          >
                            {catInfo.label}
                          </span>
                        </div>
                        <button
                          class={`help-favorite-btn ${isFav ? 'active' : ''}`}
                          onClick={() => helpActions.toggleFavorite(cmd.name)}
                          title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                        >
                          {isFav ? '★' : '☆'}
                        </button>
                      </div>

                      <div class="help-command-desc">
                        {helpState.beginnerMode
                          ? cmd.description
                          : cmd.description}
                      </div>

                      <Show when={COMMAND_DEPENDENCIES[cmd.name]}>
                        <div class="help-command-dependencies">
                          <span class="dependency-icon">⚠️</span>
                          <span class="dependency-text">
                            Requires: {COMMAND_DEPENDENCIES[cmd.name].requires}
                            <br />
                            <small>{COMMAND_DEPENDENCIES[cmd.name].message}</small>
                          </span>
                        </div>
                      </Show>

                      <div class="help-command-usage">
                        <span class="help-usage-label">Usage:</span>
                        <code>{cmd.usage}</code>
                      </div>

                      <div class="help-command-actions">
                        <button
                          class="help-action-btn primary"
                          onClick={() => runCommand(cmd.name)}
                        >
                          RUN
                        </button>
                        <button
                          class="help-action-btn"
                          onClick={() => copyCommand(cmd.name)}
                        >
                          COPY
                        </button>
                        <Show when={item.hasGUI}>
                          <button
                            class="help-action-btn"
                            onClick={() => openGUI(item.guiModal)}
                          >
                            OPEN GUI
                          </button>
                        </Show>
                      </div>
                    </div>
                  );
                }}
              </For>
            </Show>
          </div>

          <div class="help-drawer-footer">
            <span>Press F1 to toggle • / to search • ESC to close</span>
            <span>{filteredCommands().length} commands</span>
          </div>
        </div>
      </div>
    </Show>
  );
}
