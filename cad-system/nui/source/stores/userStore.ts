
import { createStore } from 'solid-js/store';
import { CONFIG } from '~/config';
import { fetchNui } from '~/utils/fetchNui';

export interface User {
  id: string;
  badge: string;
  name: string;
  role: 'police' | 'ems' | 'dispatch' | 'admin';
  department?: string;
  rank?: string;
}

interface UserState {
  currentUser: User | null;
  isAuthenticated: boolean;
}

interface OfficerPayload {
  identifier?: string;
  callsign?: string;
  name?: string;
  job?: string;
  jobLabel?: string;
  grade?: number | string;
  isAdmin?: boolean;
}

function mapJobToRole(payload: OfficerPayload): User['role'] {
  if (payload.isAdmin) {
    return 'admin';
  }

  const job = `${payload.job || ''}`.toLowerCase();
  if (job === 'dispatch') {
    return 'dispatch';
  }
  if (job === 'ambulance' || job === 'ems') {
    return 'ems';
  }

  return 'police';
}

function mapOfficerToUser(payload: OfficerPayload): User {
  return {
    id: payload.identifier || 'UNKNOWN',
    badge: payload.callsign || 'N/A',
    name: payload.name || 'Unknown Officer',
    role: mapJobToRole(payload),
    department: payload.jobLabel || payload.job || 'Unknown',
    rank: payload.grade !== undefined ? String(payload.grade) : undefined,
  };
}

const initialState: UserState = {
  currentUser: null,
  isAuthenticated: false,
};

export const [userState, setUserState] = createStore<UserState>(initialState);

export const userActions = {
  init: async () => {
    if (CONFIG.USE_MOCK_DATA) {
      setUserState({
        currentUser: {
          id: CONFIG.MOCK_USER.id,
          badge: CONFIG.MOCK_USER.badge,
          name: CONFIG.MOCK_USER.name,
          role: CONFIG.MOCK_USER.role,
          department: 'LSPD',
          rank: 'Officer',
        },
        isAuthenticated: true,
      });
      return;
    }

    try {
      const officer = await fetchNui<OfficerPayload>('getPlayerData');
      if (!officer) {
        setUserState({
          currentUser: null,
          isAuthenticated: false,
        });
        return;
      }

      setUserState({
        currentUser: mapOfficerToUser(officer),
        isAuthenticated: true,
      });
    } catch (error) {
      console.error('[UserStore] Failed to fetch player data', error);
      setUserState({
        currentUser: null,
        isAuthenticated: false,
      });
    }
  },

  setUser: (user: User) => {
    setUserState({
      currentUser: user,
      isAuthenticated: true,
    });
  },

  clearUser: () => {
    setUserState({
      currentUser: null,
      isAuthenticated: false,
    });
  },

  getCurrentUserId: (): string => {
    return userState.currentUser?.id || 'UNKNOWN';
  },

  getCurrentUserName: (): string => {
    return userState.currentUser?.name || 'Unknown Officer';
  },

  hasPermission: (requiredRole: User['role'] | User['role'][]): boolean => {
    if (!userState.currentUser) return false;

    if (CONFIG.USE_MOCK_DATA && CONFIG.MOCK_BYPASS_ROLE_GUARDS) {
      return true;
    }
    
    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    return roles.includes(userState.currentUser.role) || userState.currentUser.role === 'admin';
  },
};
