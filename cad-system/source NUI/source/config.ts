type UIMode = 'dock' | 'terminal' | 'hybrid';
type UserRole = 'police' | 'ems' | 'dispatch' | 'admin';

const truthyValues = new Set(['1', 'true', 'yes', 'on']);
const falsyValues = new Set(['0', 'false', 'no', 'off']);

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (truthyValues.has(normalized)) {
    return true;
  }
  if (falsyValues.has(normalized)) {
    return false;
  }

  return fallback;
}

function parseMode(value: string | undefined, fallback: UIMode): UIMode {
  if (!value) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'dock' || normalized === 'terminal' || normalized === 'hybrid') {
    return normalized;
  }

  return fallback;
}

function parseRole(value: string | undefined, fallback: UserRole): UserRole {
  if (!value) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (
    normalized === 'police' ||
    normalized === 'ems' ||
    normalized === 'dispatch' ||
    normalized === 'admin'
  ) {
    return normalized;
  }

  return fallback;
}

const env = import.meta.env;
const isProductionBuild = Boolean(env.PROD);

const useMockData = parseBoolean(env.VITE_USE_MOCK_DATA, !isProductionBuild);
const mockBypassRoleGuards = parseBoolean(
  env.VITE_MOCK_BYPASS_ROLE_GUARDS,
  useMockData && !isProductionBuild
);
const dockOnly = parseBoolean(env.VITE_DOCK_ONLY, true);
const configuredMode = parseMode(env.VITE_UI_MODE, 'dock');
const dispatchFeature = parseBoolean(env.VITE_FEATURE_DISPATCH, true);
const forensicsFeature = parseBoolean(env.VITE_FEATURE_FORENSICS, true);
const newsFeature = parseBoolean(env.VITE_FEATURE_NEWS, true);

export const CONFIG = {
  USE_MOCK_DATA: useMockData,
  MOCK_BYPASS_ROLE_GUARDS: mockBypassRoleGuards,

  DOCK_ONLY: dockOnly,
  UI_MODE: (dockOnly ? 'dock' : configuredMode) as UIMode,

  FEATURES: {
    DISPATCH: dispatchFeature,
    FORENSICS: forensicsFeature,
    NEWS: newsFeature,
  },

  MOCK_USER: {
    id: env.VITE_MOCK_USER_ID || 'OFFICER_101',
    badge: env.VITE_MOCK_USER_BADGE || 'B-101',
    name: env.VITE_MOCK_USER_NAME || 'Officer John Martinez',
    role: parseRole(env.VITE_MOCK_USER_ROLE, 'police'),
  },

  API_BASE_URL: env.VITE_API_URL || 'https://cad-system',

  TERMINAL: {
    MAX_HISTORY: 100,
    MAX_LINES: 500,
  },
};
