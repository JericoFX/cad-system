
import { createStore } from 'solid-js/store';
import { registry } from '~/commands/registry';
import { userState } from '~/stores/userStore';
import { featureActions } from '~/stores/featureStore';
import { CONFIG } from '~/config';

export type PaletteItemType = 'command' | 'gui' | 'action';

export interface PaletteItem {
  id: string;
  type: PaletteItemType;
  title: string;
  subtitle: string;
  icon?: string;
  command?: string;
  modal?: string;
  category: string;
  keywords: string[];
}

interface CommandPaletteState {
  isOpen: boolean;
  searchQuery: string;
  selectedIndex: number;
  items: PaletteItem[];
  filteredItems: PaletteItem[];
}

const MODAL_ROLE_ACCESS: Record<string, Array<'police' | 'ems' | 'dispatch' | 'admin'>> = {
  CASE_MANAGER: ['police', 'ems', 'dispatch', 'admin'],
  CASE_CREATOR: ['police', 'ems', 'dispatch', 'admin'],
  DISPATCH_PANEL: ['police', 'ems', 'dispatch', 'admin'],
  MAP: ['police', 'ems', 'dispatch', 'admin'],
  PERSON_SEARCH: ['police', 'ems', 'dispatch', 'admin'],
  VEHICLE_SEARCH: ['police', 'dispatch', 'admin'],
  EVIDENCE: ['police', 'dispatch', 'admin'],
  UPLOAD: ['police', 'dispatch', 'admin'],
  NOTES: ['police', 'ems', 'dispatch', 'admin'],
  NOTES_FILE: ['police', 'ems', 'dispatch', 'admin'],
  POLICE_DASHBOARD: ['police', 'admin'],
  EMS_DASHBOARD: ['ems', 'admin'],
  BOLO_MANAGER: ['police', 'dispatch', 'admin'],
  ARREST_WIZARD: ['police', 'admin'],
  ARREST_FORM: ['police', 'admin'],
  FINE_MANAGER: ['police', 'dispatch', 'admin'],
  RADIO_PANEL: ['police', 'ems', 'dispatch', 'admin'],
  RADIO_MARKERS: ['police', 'ems', 'dispatch', 'admin'],
  NEWS_MANAGER: ['police', 'dispatch', 'admin', 'ems'],
};

function filterItemsByRole(items: PaletteItem[]): PaletteItem[] {
  if (CONFIG.USE_MOCK_DATA && CONFIG.MOCK_BYPASS_ROLE_GUARDS) {
    return items;
  }

  const role = userState.currentUser?.role;
  if (!role) {
    return [];
  }

  return items.filter((item) => {
    if (item.modal && !featureActions.isModalEnabled(item.modal)) {
      return false;
    }

    if (!item.modal) {
      return true;
    }
    const allowedRoles = MODAL_ROLE_ACCESS[item.modal];
    if (!allowedRoles) {
      return true;
    }
    return allowedRoles.includes(role);
  });
}

function generatePaletteItems(): PaletteItem[] {
  const items: PaletteItem[] = [];
  
  const commands = registry.getAll();
  commands.forEach((cmd) => {
    items.push({
      id: `cmd-${cmd.name}`,
      type: 'command',
      title: cmd.name,
      subtitle: cmd.description,
      command: cmd.name,
      category: (cmd as any).category || 'SYSTEM',
      keywords: [cmd.name, ...(cmd.aliases || []), cmd.description],
    });
  });
  
  const guiModals: Array<{ modal: string; title: string; subtitle: string; category: string; icon: string }> = [
    { modal: 'CASE_MANAGER', title: 'Case Manager', subtitle: 'Browse, update, and close cases', category: 'cases', icon: '🗂️' },
    { modal: 'CASE_CREATOR', title: 'Case Creator', subtitle: 'Create new case', category: 'cases', icon: '📁' },
    { modal: 'DISPATCH_PANEL', title: 'Dispatch Panel', subtitle: 'View active units and calls', category: 'DISPATCH', icon: '📡' },
    { modal: 'PERSON_SEARCH', title: 'Search Person', subtitle: 'Search person database', category: 'SEARCH', icon: '👤' },
    { modal: 'VEHICLE_SEARCH', title: 'Search Vehicle', subtitle: 'Search vehicle database', category: 'SEARCH', icon: '🚗' },
    { modal: 'EVIDENCE', title: 'Evidence Manager', subtitle: 'Manage case evidence', category: 'evidence', icon: '📎' },
    { modal: 'UPLOAD', title: 'Upload Evidence', subtitle: 'Upload new evidence', category: 'evidence', icon: '⬆️' },
    { modal: 'NOTES', title: 'Notes Editor', subtitle: 'Edit case notes', category: 'notes', icon: '📝' },
    { modal: 'NOTES_FILE', title: 'Notes File Manager', subtitle: 'Manage note files', category: 'notes', icon: '📄' },
    { modal: 'POLICE_DASHBOARD', title: 'Police Dashboard', subtitle: 'Police operations center', category: 'POLICE', icon: '👮' },
    { modal: 'EMS_DASHBOARD', title: 'EMS Dashboard', subtitle: 'EMS operations center', category: 'EMS', icon: '🚑' },
    { modal: 'BOLO_MANAGER', title: 'BOLO Manager', subtitle: 'Manage BOLOs', category: 'POLICE', icon: '⚠️' },
    { modal: 'ARREST_WIZARD', title: 'Arrest Wizard', subtitle: 'Process arrest', category: 'POLICE', icon: '⛓️' },
    { modal: 'ARREST_FORM', title: 'Quick Arrest', subtitle: 'Quick arrest form', category: 'POLICE', icon: '📋' },
    { modal: 'FINE_MANAGER', title: 'Fine Manager', subtitle: 'Issue and manage fines', category: 'Fines', icon: '💰' },
    { modal: 'LICENSE_MANAGER', title: 'License Manager', subtitle: 'Manage licenses', category: 'CIVIL', icon: '🪪' },
    { modal: 'PROPERTY_MANAGER', title: 'Property Manager', subtitle: 'Manage properties', category: 'CIVIL', icon: '🏠' },
    { modal: 'FLEET_MANAGER', title: 'Fleet Manager', subtitle: 'Manage fleet vehicles', category: 'LOGISTICS', icon: '🚓' },
    { modal: 'RADIO_PANEL', title: 'Radio Panel', subtitle: 'Radio communications', category: 'COMMS', icon: '📻' },
    { modal: 'RADIO_MARKERS', title: 'Radio Markers', subtitle: 'Marked radio messages', category: 'COMMS', icon: '📌' },
    { modal: 'NEWS_MANAGER', title: 'News Manager', subtitle: 'Manage news articles', category: 'NEWS', icon: '📰' },
    { modal: 'MAP', title: 'Tactical Map', subtitle: 'View tactical map', category: 'SYSTEM', icon: '🗺️' },
    { modal: 'PERSON_SNAPSHOT', title: 'Person Snapshot', subtitle: 'Quick person view', category: 'SEARCH', icon: '🆔' },
  ];
  
  guiModals.forEach((gui) => {
    items.push({
      id: `gui-${gui.modal}`,
      type: 'gui',
      title: gui.title,
      subtitle: gui.subtitle,
      modal: gui.modal,
      category: gui.category,
      icon: gui.icon,
      keywords: [gui.title, gui.subtitle, gui.category, 'gui', 'open'],
    });
  });
  
  const quickActions: Array<{ id: string; title: string; subtitle: string; command: string; category: string; icon: string }> = [
    { id: 'action-clear', title: 'Clear Terminal', subtitle: 'Clear terminal screen', command: 'clear', category: 'SYSTEM', icon: '🧹' },
    { id: 'action-help', title: 'Open Help', subtitle: 'Show command guide', command: 'help', category: 'SYSTEM', icon: '❓' },
    { id: 'action-status', title: 'System Status', subtitle: 'Show system status', command: 'status', category: 'SYSTEM', icon: 'ℹ️' },
    { id: 'action-exit', title: 'Exit CAD', subtitle: 'Close CAD system', command: 'exit', category: 'SYSTEM', icon: '🚪' },
  ];
  
  quickActions.forEach((action) => {
    items.push({
      id: action.id,
      type: 'action',
      title: action.title,
      subtitle: action.subtitle,
      command: action.command,
      category: action.category,
      icon: action.icon,
      keywords: [action.title, action.subtitle, 'action', 'quick'],
    });
  });
  
  return items;
}

function fuzzySearch(query: string, items: PaletteItem[]): PaletteItem[] {
  if (!query.trim()) return items;
  
  const normalizedQuery = query.toLowerCase().trim();
  const queryParts = normalizedQuery.split(/\s+/);
  
  return items
    .map((item) => {
      let score = 0;
      const searchableText = `${item.title} ${item.subtitle} ${item.keywords.join(' ')}`.toLowerCase();
      
      if (item.title.toLowerCase() === normalizedQuery) {
        score += 100;
      }
      else if (item.title.toLowerCase().startsWith(normalizedQuery)) {
        score += 80;
      }
      else if (item.title.toLowerCase().includes(normalizedQuery)) {
        score += 60;
      }
      else if (queryParts.every((part) => searchableText.includes(part))) {
        score += 40;
      }
      else {
        const matchingParts = queryParts.filter((part) => searchableText.includes(part));
        score += matchingParts.length * 20;
      }
      
      if (item.type === 'gui') score += 5;
      
      return { item, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item);
}

const initialState: CommandPaletteState = {
  isOpen: false,
  searchQuery: '',
  selectedIndex: 0,
  items: generatePaletteItems(),
  filteredItems: generatePaletteItems(),
};

export const [commandPaletteState, setCommandPaletteState] = createStore(initialState);

export const commandPaletteActions = {
  open: () => {
    const freshItems = generatePaletteItems();
    const roleFilteredItems = filterItemsByRole(freshItems);
    setCommandPaletteState({
      isOpen: true,
      searchQuery: '',
      selectedIndex: 0,
      items: freshItems,
      filteredItems: roleFilteredItems,
    });
  },
  
  close: () => {
    setCommandPaletteState('isOpen', false);
  },
  
  toggle: () => {
    if (commandPaletteState.isOpen) {
      commandPaletteActions.close();
    } else {
      commandPaletteActions.open();
    }
  },
  
  setSearchQuery: (query: string) => {
    const roleFilteredItems = filterItemsByRole(commandPaletteState.items);
    const filtered = fuzzySearch(query, roleFilteredItems);
    setCommandPaletteState({
      searchQuery: query,
      filteredItems: filtered,
      selectedIndex: 0,
    });
  },
  
  selectNext: () => {
    setCommandPaletteState('selectedIndex', (prev) => 
      Math.min(prev + 1, commandPaletteState.filteredItems.length - 1)
    );
  },
  
  selectPrevious: () => {
    setCommandPaletteState('selectedIndex', (prev) => Math.max(prev - 1, 0));
  },
  
  getSelectedItem: (): PaletteItem | null => {
    return commandPaletteState.filteredItems[commandPaletteState.selectedIndex] || null;
  },
  
  clearSearch: () => {
    const roleFilteredItems = filterItemsByRole(commandPaletteState.items);
    setCommandPaletteState({
      searchQuery: '',
      filteredItems: roleFilteredItems,
      selectedIndex: 0,
    });
  },
  
  refreshItems: () => {
    const newItems = generatePaletteItems();
    const roleFilteredItems = filterItemsByRole(newItems);
    setCommandPaletteState({
      items: newItems,
      filteredItems: fuzzySearch(commandPaletteState.searchQuery, roleFilteredItems),
    });
  },
};
