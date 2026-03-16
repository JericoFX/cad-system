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
  news?: Partial<ModuleFeature> & { publishWithoutConfirm?: boolean };
  ems?: Partial<ModuleFeature>;
  map?: Partial<ModuleFeature>;
  radio?: Partial<ModuleFeature>;
  phoneIntel?: Partial<ModuleFeature>;
};

interface FeatureState {
  loaded: boolean;
  dispatch: ModuleFeature;
  forensics: ModuleFeature;
  news: ModuleFeature;
  newsPublishWithoutConfirm: boolean;
  ems: ModuleFeature;
  map: ModuleFeature;
  radio: ModuleFeature;
  phoneIntel: ModuleFeature;
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
  newsPublishWithoutConfirm: false,
  ems: {
    enabled: CONFIG.FEATURES.EMS,
    visible: CONFIG.FEATURES.EMS,
  },
  map: {
    enabled: CONFIG.FEATURES.MAP,
    visible: CONFIG.FEATURES.MAP,
  },
  radio: {
    enabled: CONFIG.FEATURES.RADIO,
    visible: CONFIG.FEATURES.RADIO,
  },
  phoneIntel: {
    enabled: CONFIG.FEATURES.PHONE_INTEL,
    visible: CONFIG.FEATURES.PHONE_INTEL,
  },
};

export const [featureState, setFeatureState] = createStore<FeatureState>(initialState);

function normalizeFeature(input?: Partial<ModuleFeature>, fallback: ModuleFeature = defaultFeature): ModuleFeature {
  return {
    enabled: input?.enabled ?? fallback.enabled,
    visible: input?.visible ?? input?.enabled ?? fallback.visible,
  };
}

const dispatchModals = new Set(['DISPATCH_PANEL']);
const forensicsModals = new Set(['FORENSIC_COLLECTION']);
const newsModals = new Set(['NEWS_MANAGER']);
const emsModals = new Set(['EMS_DASHBOARD']);
const mapModals = new Set(['MAP']);
const radioModals = new Set(['RADIO_PANEL', 'RADIO_MARKERS']);
const phoneIntelModals = new Set(['PERSON_SEARCH']);

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
        newsPublishWithoutConfirm: payload?.news?.publishWithoutConfirm === true,
        ems: normalizeFeature(payload?.ems, featureState.ems),
        map: normalizeFeature(payload?.map, featureState.map),
        radio: normalizeFeature(payload?.radio, featureState.radio),
        phoneIntel: normalizeFeature(payload?.phoneIntel, featureState.phoneIntel),
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

    if (emsModals.has(modalName)) {
      return featureState.ems.enabled && featureState.ems.visible;
    }

    if (mapModals.has(modalName)) {
      return featureState.map.enabled && featureState.map.visible;
    }

    if (radioModals.has(modalName)) {
      return featureState.radio.enabled && featureState.radio.visible;
    }

    if (phoneIntelModals.has(modalName)) {
      return featureState.phoneIntel.enabled && featureState.phoneIntel.visible;
    }

    return true;
  },
};
