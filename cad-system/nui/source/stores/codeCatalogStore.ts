import { createStore } from 'solid-js/store';
import { fetchNui } from '~/utils/fetchNui';
import { CONFIG } from '~/config';
import {
  TEN_CODES as fallbackTenCodes,
  PRIORITY_CODES as fallbackPriorityCodes,
  CASE_TYPES as fallbackCaseTypes,
  STATUS_CODES as fallbackStatusCodes,
} from '~/data/codes';

export type StatusCodeInfo = {
  label: string;
  color: string;
};

type CodeCatalogPayload = {
  tenCodes?: Record<string, string>;
  priorityCodes?: Record<string, string>;
  caseTypes?: Record<string, string>;
  statusCodes?: Record<string, Partial<StatusCodeInfo>>;
};

interface CodeCatalogState {
  loaded: boolean;
  tenCodes: Record<string, string>;
  priorityCodes: Record<string, string>;
  caseTypes: Record<string, string>;
  statusCodes: Record<string, StatusCodeInfo>;
}

const initialState: CodeCatalogState = {
  loaded: false,
  tenCodes: { ...fallbackTenCodes },
  priorityCodes: { ...fallbackPriorityCodes },
  caseTypes: { ...fallbackCaseTypes },
  statusCodes: { ...fallbackStatusCodes },
};

export const [codeCatalogState, setCodeCatalogState] = createStore<CodeCatalogState>(initialState);

function normalizeStatusCodes(input?: Record<string, Partial<StatusCodeInfo>>): Record<string, StatusCodeInfo> {
  const fallback = codeCatalogState.statusCodes;
  if (!input || typeof input !== 'object') {
    return fallback;
  }

  const out: Record<string, StatusCodeInfo> = {};
  Object.entries(input).forEach(([code, row]) => {
    if (!row || typeof row !== 'object') {
      return;
    }

    const label = typeof row.label === 'string' && row.label.trim() !== '' ? row.label : null;
    if (!label) {
      return;
    }

    const color = typeof row.color === 'string' && row.color.trim() !== '' ? row.color : '#808080';
    out[code.toUpperCase()] = { label, color };
  });

  if (Object.keys(out).length === 0) {
    return fallback;
  }

  return out;
}

function normalizeStringMap(
  input: Record<string, string> | undefined,
  fallback: Record<string, string>
): Record<string, string> {
  if (!input || typeof input !== 'object') {
    return fallback;
  }

  const out: Record<string, string> = {};
  Object.entries(input).forEach(([key, value]) => {
    if (typeof key !== 'string' || typeof value !== 'string') {
      return;
    }
    if (key.trim() === '' || value.trim() === '') {
      return;
    }
    out[key] = value;
  });

  if (Object.keys(out).length === 0) {
    return fallback;
  }

  return out;
}

export const codeCatalogActions = {
  load: async () => {
    if (CONFIG.USE_MOCK_DATA) {
      setCodeCatalogState('loaded', true);
      return;
    }

    try {
      const payload = await fetchNui<CodeCatalogPayload>('cad:getCodeCatalog');
      setCodeCatalogState({
        loaded: true,
        tenCodes: normalizeStringMap(payload?.tenCodes, codeCatalogState.tenCodes),
        priorityCodes: normalizeStringMap(payload?.priorityCodes, codeCatalogState.priorityCodes),
        caseTypes: normalizeStringMap(payload?.caseTypes, codeCatalogState.caseTypes),
        statusCodes: normalizeStatusCodes(payload?.statusCodes),
      });
    } catch (error) {
      console.error('[CodeCatalogStore] Failed to load code catalog', error);
      setCodeCatalogState('loaded', true);
    }
  },

  getStatusInfo: (code: string): StatusCodeInfo | undefined => {
    return codeCatalogState.statusCodes[code.toUpperCase()];
  },
};
