
import { createStore } from 'solid-js/store';
import { userState } from './userStore';
import { CONFIG } from '~/config';

export type UserRole = 'police' | 'ems' | 'dispatch' | 'admin';

export interface QuickAction {
  id: string;
  label: string;
  icon: string;
  command?: string;
  modal?: string;
  color: string;
}

export interface HomeActivity {
  type: string;
  description: string;
  timestamp: string;
}

interface HomeState {
  isVisible: boolean;
  activeRole: UserRole | null;
  actions: QuickAction[];
  recentActivity: HomeActivity[];
}

const getDefaultActions = (role: UserRole): QuickAction[] => {
  const common: QuickAction[] = [
    { id: 'dispatch', label: 'Dispatch', icon: '📡', modal: 'DISPATCH_PANEL', color: '#ff00ff' },
    { id: 'search-person', label: 'Person', icon: '👤', modal: 'PERSON_SEARCH', color: '#ffff00' },
  ];
  
  switch (role) {
    case 'police':
      return [
        { id: 'new-case', label: 'New Case', icon: '📁', modal: 'CASE_CREATOR', color: '#00ff00' },
        { id: 'arrest', label: 'Arrest', icon: '⛓️', modal: 'ARREST_WIZARD', color: '#ff0000' },
        { id: 'bolo', label: 'BOLO', icon: '⚠️', modal: 'BOLO_MANAGER', color: '#ff8000' },
        ...common,
        { id: 'evidence', label: 'Evidence', icon: '📎', modal: 'EVIDENCE', color: '#80ffff' },
      ];
    case 'ems':
      return [
        { id: 'triage', label: 'Triage', icon: '🏥', command: 'triage', color: '#ff8000' },
        { id: 'treatment', label: 'Treatment', icon: '💊', command: 'treatment', color: '#00ff00' },
        ...common,
        { id: 'ems-dash', label: 'EMS Dash', icon: '🚑', modal: 'EMS_DASHBOARD', color: '#ff0000' },
      ];
    case 'dispatch':
      return [
        { id: 'new-call', label: 'New Call', icon: '📞', modal: 'MAP', color: '#ff0000' },
        { id: 'units', label: 'Units', icon: '🚓', modal: 'DISPATCH_PANEL', color: '#0080ff' },
        ...common,
        { id: 'radio', label: 'Radio', icon: '📻', modal: 'RADIO_PANEL', color: '#00ffff' },
      ];
    default:
      return common;
  }
};

const getAllMockActions = (): QuickAction[] => {
  const byId = new Map<string, QuickAction>();
  const roles: UserRole[] = ['police', 'ems', 'dispatch'];

  for (let i = 0; i < roles.length; i++) {
    const roleActions = getDefaultActions(roles[i]);
    for (let j = 0; j < roleActions.length; j++) {
      const action = roleActions[j];
      if (!byId.has(action.id)) {
        byId.set(action.id, action);
      }
    }
  }

  return Array.from(byId.values());
};

const initialState: HomeState = {
  isVisible: false,
  activeRole: null,
  actions: [],
  recentActivity: [],
};

export const [homeState, setHomeState] = createStore<HomeState>(initialState);

export const homeActions = {
  show: () => {
    if (CONFIG.USE_MOCK_DATA && CONFIG.MOCK_BYPASS_ROLE_GUARDS) {
      setHomeState({
        isVisible: true,
        activeRole: 'admin',
        actions: getAllMockActions(),
      });
      return;
    }

    const role = (userState.currentUser?.role as UserRole) || 'police';
    setHomeState({
      isVisible: true,
      activeRole: role,
      actions: getDefaultActions(role),
    });
  },
  
  hide: () => {
    setHomeState('isVisible', false);
  },
  
  toggle: () => {
    if (homeState.isVisible) {
      homeActions.hide();
    } else {
      homeActions.show();
    }
  },
  
  setRole: (role: UserRole) => {
    setHomeState({
      activeRole: role,
      actions: getDefaultActions(role),
    });
  },
};
