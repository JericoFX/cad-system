
import { createStore } from 'solid-js/store';
import { userState } from './userStore';
import { featureActions } from './featureStore';

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
  activeRole: UserRole | null;
  actions: QuickAction[];
  recentActivity: HomeActivity[];
}

const getDefaultActions = (role: UserRole): QuickAction[] => {
  const common: QuickAction[] = [
    { id: 'dispatch', label: 'Dispatch', icon: '📡', modal: 'DISPATCH_PANEL', color: '#ff00ff' },
    { id: 'search-person', label: 'Person', icon: '👤', modal: 'PERSON_SEARCH', color: '#ffff00' },
  ];
  
  let actions: QuickAction[]

  switch (role) {
    case 'police':
      actions = [
        { id: 'new-case', label: 'New Case', icon: '📁', modal: 'CASE_CREATOR', color: '#00ff00' },
        { id: 'arrest', label: 'Arrest', icon: '⛓️', modal: 'ARREST_WIZARD', color: '#ff0000' },
        { id: 'bolo', label: 'BOLO', icon: '⚠️', modal: 'BOLO_MANAGER', color: '#ff8000' },
        { id: 'forensics', label: 'Forensics', icon: '🔬', modal: 'FORENSIC_COLLECTION', color: '#00ffff' },
        ...common,
        { id: 'evidence', label: 'Evidence', icon: '📎', modal: 'EVIDENCE', color: '#80ffff' },
      ];
      break;
    case 'ems':
      actions = [
        { id: 'triage', label: 'Triage', icon: '🏥', command: 'triage', color: '#ff8000' },
        { id: 'treatment', label: 'Treatment', icon: '💊', command: 'treatment', color: '#00ff00' },
        { id: 'forensics', label: 'Forensics', icon: '🔬', modal: 'FORENSIC_COLLECTION', color: '#00ffff' },
        ...common,
        { id: 'ems-dash', label: 'EMS Dash', icon: '🚑', modal: 'EMS_DASHBOARD', color: '#ff0000' },
      ];
      break;
    case 'dispatch':
      actions = [
        { id: 'new-call', label: 'New Call', icon: '📞', modal: 'MAP', color: '#ff0000' },
        { id: 'units', label: 'Units', icon: '🚓', modal: 'DISPATCH_PANEL', color: '#0080ff' },
        ...common,
        { id: 'radio', label: 'Radio', icon: '📻', modal: 'RADIO_PANEL', color: '#00ffff' },
      ];
      break;
    default:
      actions = common;
      break;
  }

  return actions.filter((action) => {
    if (!action.modal) {
      return true;
    }

    return featureActions.isModalEnabled(action.modal);
  });
};

const initialState: HomeState = {
  activeRole: null,
  actions: [],
  recentActivity: [],
};

export const [homeState, setHomeState] = createStore<HomeState>(initialState);

export const homeActions = {
  init: () => {
    const role = (userState.currentUser?.role as UserRole) || 'police';
    setHomeState({
      activeRole: role,
      actions: getDefaultActions(role),
    });
  },

  reset: () => {
    setHomeState({
      activeRole: null,
      actions: [],
    });
  },
  
  setRole: (role: UserRole) => {
    setHomeState({
      activeRole: role,
      actions: getDefaultActions(role),
    });
  },
};
