import { createStore } from 'solid-js/store';
import { CONFIG } from '~/config';
import { fetchNui } from '~/utils/fetchNui';

type ModuleFeature = {
  enabled: boolean;
  visible: boolean;
};

type FeaturePayload = {
  dispatch?: Partial<ModuleFeature>;
  forensics?: Partial<ModuleFeature>;
  news?: Partial<ModuleFeature>;
};

interface FeatureState {
  loaded: boolean;
  dispatch: ModuleFeature;
  forensics: ModuleFeature;
  news: ModuleFeature;
}

const defaultFeature: ModuleFeature = {
  enabled: true,
  visible: true,
};

const initialState: FeatureState = {
  loaded: false,
  dispatch: {
    enabled: CONFIG.FEATURES.DISPATCH,
    visible: CONFIG.FEATURES.DISPATCH,
  },
  forensics: {
    enabled: CONFIG.FEATURES.FORENSICS,
    visible: CONFIG.FEATURES.FORENSICS,
  },
  news: {
    enabled: CONFIG.FEATURES.NEWS,
    visible: CONFIG.FEATURES.NEWS,
  },
};

export const [featureState, setFeatureState] = createStore<FeatureState>(initialState);

function normalizeFeature(input?: Partial<ModuleFeature>, fallback: ModuleFeature = defaultFeature): ModuleFeature {
  return {
    enabled: input?.enabled ?? fallback.enabled,
    visible: input?.visible ?? input?.enabled ?? fallback.visible,
  };
}

const dispatchModals = new Set(['DISPATCH_PANEL', 'MAP']);
const forensicsModals = new Set(['FORENSIC_COLLECTION']);
const newsModals = new Set(['NEWS_MANAGER']);

export const featureActions = {
  load: async () => {
    if (CONFIG.USE_MOCK_DATA) {
      setFeatureState('loaded', true);
      return;
    }

    try {
      const payload = await fetchNui<FeaturePayload>('cad:getUiFeatures');

      setFeatureState({
        loaded: true,
        dispatch: normalizeFeature(payload?.dispatch, featureState.dispatch),
        forensics: normalizeFeature(payload?.forensics, featureState.forensics),
        news: normalizeFeature(payload?.news, featureState.news),
      });
    } catch (error) {
      console.error('[FeatureStore] Failed to load feature flags', error);
      setFeatureState('loaded', true);
    }
  },

  isModalEnabled: (modalName: string | null | undefined): boolean => {
    if (!modalName) {
      return true;
    }

    if (dispatchModals.has(modalName)) {
      return featureState.dispatch.enabled && featureState.dispatch.visible;
    }

    if (forensicsModals.has(modalName)) {
      return featureState.forensics.enabled && featureState.forensics.visible;
    }

    if (newsModals.has(modalName)) {
      return featureState.news.enabled && featureState.news.visible;
    }

    return true;
  },
};
