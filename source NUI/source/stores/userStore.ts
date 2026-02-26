
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
  callsign: string | null;
  needsCallsign: boolean;
  callsignValidated: boolean;
}

interface OfficerPayload {
  identifier?: string;
  callsign?: string;
  name?: string;
  job?: string;
  jobLabel?: string;
  grade?: number | string;
  isAdmin?: boolean;
  hasCallsign?: boolean;
  callsignPolicy?: {
    requireWhenEmpty?: boolean;
    blockedPrefixes?: string[];
  };
}

function needsCallsignSetup(
  callsign: string | null,
  policy?: { requireWhenEmpty?: boolean; blockedPrefixes?: string[] }
): boolean {
  const requireWhenEmpty = policy?.requireWhenEmpty !== false;
  if (!callsign || !callsign.trim()) {
    return requireWhenEmpty;
  }

  const normalized = callsign.toUpperCase().trim();
  const blockedPrefixes =
    Array.isArray(policy?.blockedPrefixes) && policy?.blockedPrefixes.length > 0
      ? policy.blockedPrefixes
      : ['B-'];

  for (let i = 0; i < blockedPrefixes.length; i += 1) {
    const prefix = String(blockedPrefixes[i] || '').toUpperCase().trim();
    if (prefix && normalized.startsWith(prefix)) {
      return true;
    }
  }

  return false;
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
  callsign: null,
  needsCallsign: false,
  callsignValidated: false,
};

export const [userState, setUserState] = createStore<UserState>(initialState);

export const userActions = {
  init: async () => {
    if (CONFIG.USE_MOCK_DATA) {
      const mockNoCallsignFlag =
        typeof window !== 'undefined' &&
        window.localStorage.getItem('cad-mock-no-callsign') === '1';
      const mockCallsignOverride =
        typeof window !== 'undefined'
          ? window.localStorage.getItem('cad-mock-callsign-override')
          : null;

      const mockCallsign = mockNoCallsignFlag
        ? null
        : mockCallsignOverride || CONFIG.MOCK_USER.badge || null;
      const mockNeedsCallsign = needsCallsignSetup(mockCallsign, {
        requireWhenEmpty: true,
        blockedPrefixes: ['B-'],
      });

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
        callsign: mockCallsign,
        needsCallsign: mockNeedsCallsign,
        callsignValidated: !mockNeedsCallsign,
      });
      return;
    }

    try {
      const officer = await fetchNui<OfficerPayload>('getPlayerData');
      if (!officer || (officer as { ok?: boolean }).ok === false) {
        setUserState({
          currentUser: null,
          isAuthenticated: false,
          callsign: null,
          needsCallsign: false,
          callsignValidated: true,
        });
        return;
      }

      const callsign = officer.callsign || null;
      const needsCallsign = needsCallsignSetup(callsign, officer.callsignPolicy);

      setUserState({
        currentUser: mapOfficerToUser(officer),
        isAuthenticated: true,
        callsign,
        needsCallsign,
        callsignValidated: !needsCallsign,
      });
    } catch (error) {
      console.error('[UserStore] Failed to fetch player data', error);
      setUserState({
        currentUser: null,
        isAuthenticated: false,
        callsign: null,
        needsCallsign: false,
        callsignValidated: true,
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

  setCallsign: (callsign: string) => {
    setUserState({
      callsign,
      needsCallsign: false,
      callsignValidated: true,
    });
    if (userState.currentUser) {
      setUserState('currentUser', 'badge', callsign);
    }
  },

  clearCallsign: () => {
    setUserState({
      callsign: null,
      needsCallsign: true,
      callsignValidated: false,
    });
  },

  validateCallsign: (input: string): { valid: boolean; error?: string } => {
    const CALLSIGN_REGEX = /^\d{1,3}-[A-Z]{2,10}-\d{1,3}$/;
    const normalized = input.toUpperCase().trim();
    
    if (!normalized) {
      return { valid: false, error: 'Ingresa tu callsign' };
    }
    
    if (!CALLSIGN_REGEX.test(normalized)) {
      return { 
        valid: false, 
        error: 'Formato inválido. Usa: 1-ADAM-15' 
      };
    }
    
    return { valid: true };
  },

  normalizeCallsign: (input: string): string => {
    return input.toUpperCase().trim();
  },

  hasCallsign: (): boolean => {
    return !!userState.callsign && !userState.needsCallsign;
  },

  saveCallsign: async (callsign: string): Promise<{ success: boolean; error?: string }> => {
    const normalized = userActions.normalizeCallsign(callsign);
    const validation = userActions.validateCallsign(normalized);
    
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    try {
      const result = await fetchNui<{ success: boolean; callsign?: string; error?: string }>(
        'cad:setCallsign', 
        { callsign: normalized }
      );
      
      if (result && result.success) {
        userActions.setCallsign(normalized);
        return { success: true };
      }
      
      return { success: false, error: result?.error || 'Error al guardar' };
    } catch (error) {
      console.error('[UserStore] Failed to save callsign', error);
      return { success: false, error: 'Error de conexión' };
    }
  },
};
