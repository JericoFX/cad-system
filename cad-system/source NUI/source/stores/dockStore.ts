
import { createStore } from 'solid-js/store';

export interface DockItem {
  id: string;
  name: string;
  icon: string;
  command: string;
  modal?: string;
  tooltip: string;
  category: 'cases' | 'dispatch' | 'search' | 'evidence' | 'police' | 'ems' | 'comms' | 'system' | 'news';
  shortcut?: string;
  roles?: Array<'police' | 'ems' | 'dispatch' | 'admin'>;
}

interface DockState {
  isVisible: boolean;
  isExpanded: boolean;
  position: 'bottom' | 'left' | 'right';
  items: DockItem[];
  activeItem: string | null;
}

const DEFAULT_DOCK_ITEMS: DockItem[] = [
  {
    id: 'cases',
    name: 'Cases',
    icon: '📁',
    command: 'case gui',
    modal: 'CASE_MANAGER',
    tooltip: 'Case Manager',
    category: 'cases',
    shortcut: 'F2',
    roles: ['police', 'dispatch', 'admin', 'ems'],
  },
  {
    id: 'case-create',
    name: 'New Case',
    icon: '➕',
    command: 'case create',
    modal: 'CASE_CREATOR',
    tooltip: 'Create Case',
    category: 'cases',
    roles: ['police', 'dispatch', 'admin'],
  },
  {
    id: 'dispatch',
    name: 'Dispatch',
    icon: '📡',
    command: 'dispatch view',
    modal: 'DISPATCH_PANEL',
    tooltip: 'Dispatch Panel',
    category: 'dispatch',
    shortcut: 'F3',
    roles: ['police', 'dispatch', 'admin'],
  },
  {
    id: 'map',
    name: 'Map',
    icon: '🗺️',
    command: 'map',
    modal: 'MAP',
    tooltip: 'Tactical Map',
    category: 'dispatch',
    shortcut: 'F6',
    roles: ['police', 'dispatch', 'admin'],
  },
  {
    id: 'person',
    name: 'Person',
    icon: '👤',
    command: 'search-person',
    modal: 'PERSON_SEARCH',
    tooltip: 'Search Person',
    category: 'search',
    roles: ['police', 'dispatch', 'admin'],
  },
  {
    id: 'vehicle',
    name: 'Vehicle',
    icon: '🚗',
    command: 'search-vehicle',
    modal: 'VEHICLE_SEARCH',
    tooltip: 'Search Vehicle',
    category: 'search',
    roles: ['police', 'dispatch', 'admin'],
  },
  {
    id: 'evidence',
    name: 'Evidence',
    icon: '📎',
    command: 'evidence',
    modal: 'EVIDENCE',
    tooltip: 'Evidence Manager',
    category: 'evidence',
    roles: ['police', 'dispatch', 'admin', 'ems'],
  },
  {
    id: 'notes',
    name: 'Notes',
    icon: '📝',
    command: 'notes',
    modal: 'NOTES',
    tooltip: 'Notes Editor',
    category: 'cases',
    roles: ['police', 'dispatch', 'admin'],
  },
  {
    id: 'bolo',
    name: 'BOLO',
    icon: '⚠️',
    command: 'bolo',
    modal: 'BOLO_MANAGER',
    tooltip: 'BOLO Manager',
    category: 'police',
    roles: ['police', 'dispatch', 'admin'],
  },
  {
    id: 'police-dash',
    name: 'Police',
    icon: '👮',
    command: 'police panel',
    modal: 'POLICE_DASHBOARD',
    tooltip: 'Police Dashboard',
    category: 'police',
    roles: ['police', 'admin'],
  },
  {
    id: 'fines',
    name: 'Fines',
    icon: '💰',
    command: 'fine gui',
    modal: 'FINE_MANAGER',
    tooltip: 'Fine Manager',
    category: 'police',
    roles: ['police', 'dispatch', 'admin'],
  },
  {
    id: 'ems-dash',
    name: 'EMS',
    icon: '🚑',
    command: 'ems dashboard',
    modal: 'EMS_DASHBOARD',
    tooltip: 'EMS Dashboard',
    category: 'ems',
    roles: ['ems', 'admin'],
  },
  {
    id: 'news',
    name: 'News',
    icon: '📰',
    command: 'news panel',
    modal: 'NEWS_MANAGER',
    tooltip: 'News Desk',
    category: 'news',
    roles: ['dispatch', 'admin', 'ems'],
  },
  {
    id: 'radio',
    name: 'Radio',
    icon: '📻',
    command: 'radio panel',
    modal: 'RADIO_PANEL',
    tooltip: 'Radio Panel',
    category: 'comms',
    shortcut: 'F4',
    roles: ['police', 'dispatch', 'admin'],
  },
];

const initialState: DockState = {
  isVisible: true,
  isExpanded: false,
  position: 'bottom',
  items: DEFAULT_DOCK_ITEMS,
  activeItem: null,
};

export const [dockState, setDockState] = createStore<DockState>(initialState);

export const dockActions = {
  toggleVisibility: () => {
    setDockState('isVisible', (v) => !v);
  },
  
  show: () => {
    setDockState('isVisible', true);
  },
  
  hide: () => {
    setDockState('isVisible', false);
  },
  
  toggleExpanded: () => {
    setDockState('isExpanded', (v) => !v);
  },
  
  setPosition: (position: DockState['position']) => {
    setDockState('position', position);
  },
  
  setActiveItem: (itemId: string | null) => {
    setDockState('activeItem', itemId);
  },
  
  addItem: (item: DockItem) => {
    setDockState('items', (items) => [...items, item]);
  },
  
  removeItem: (itemId: string) => {
    setDockState('items', (items) => items.filter((i) => i.id !== itemId));
  },
  
  reorderItems: (newOrder: string[]) => {
    setDockState('items', (items) => {
      const itemMap = new Map(items.map((i) => [i.id, i]));
      return newOrder.map((id) => itemMap.get(id)).filter(Boolean) as DockItem[];
    });
  },
};
