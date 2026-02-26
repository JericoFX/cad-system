/**
 * App Store
 * Centralized visibility state for the entire CAD application
 * Controlled exclusively by Lua via NUI messages
 */

import { createStore } from 'solid-js/store';
import { isEnvBrowser } from '~/utils/misc';
import { CONFIG } from '~/config';

interface AppState {
  isVisible: boolean;
  hasBootCompleted: boolean;
  isBooting: boolean;
  bootStep: string;
  bootProgress: number;
  bootLines: string[];
  skipBootRequested: boolean;
  bootStartedAt: number | null;
  bootOfficer: {
    name: string;
    rank?: string;
    department?: string;
    callsign?: string | null;
  } | null;
  bootConfig: {
    enabled: boolean;
    skippable: boolean;
    minDurationMs: number;
    soundsEnabled: boolean;
  };
}

type BootConfig = AppState['bootConfig'];

function loadBootOverrides(): Partial<BootConfig> {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const raw = localStorage.getItem('cad-boot-preferences');
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as Partial<BootConfig>;
    return {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : undefined,
      skippable: typeof parsed.skippable === 'boolean' ? parsed.skippable : undefined,
      soundsEnabled: typeof parsed.soundsEnabled === 'boolean' ? parsed.soundsEnabled : undefined,
      minDurationMs:
        typeof parsed.minDurationMs === 'number' && Number.isFinite(parsed.minDurationMs)
          ? Math.min(10000, Math.max(300, parsed.minDurationMs))
          : undefined,
    };
  } catch {
    return {};
  }
}

function saveBootOverrides(config: BootConfig): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem('cad-boot-preferences', JSON.stringify(config));
  } catch {
  }
}

function getBootDefaults(): BootConfig {
  return {
    enabled: CONFIG.BOOT.ENABLED,
    skippable: CONFIG.BOOT.SKIPPABLE,
    minDurationMs: CONFIG.BOOT.MIN_DURATION_MS,
    soundsEnabled: CONFIG.BOOT.SOUNDS_ENABLED,
    ...loadBootOverrides(),
  };
}

const initialState: AppState = {
  isVisible: false,
  hasBootCompleted: false,
  isBooting: false,
  bootStep: 'Initializing',
  bootProgress: 0,
  bootLines: [],
  skipBootRequested: false,
  bootStartedAt: null,
  bootOfficer: null,
  bootConfig: getBootDefaults(),
};

export const [appState, setAppState] = createStore<AppState>(initialState);

export const appActions = {
  /**
   * Show the entire CAD application
   * Called when receiving 'cad:opened' from Lua
   */
  show: () => {
    setAppState('isVisible', isEnvBrowser() || true);
    console.log('[AppStore] CAD shown');
  },

  /**
   * Hide the entire CAD application
   * Called when receiving 'cad:closed' from Lua or when player closes UI
   */
  hide: () => {
    setAppState({
      isVisible: false,
      isBooting: false,
      bootStep: 'Initializing',
      bootProgress: 0,
      bootLines: [],
      skipBootRequested: false,
      bootStartedAt: null,
      bootOfficer: null,
    });
    console.log('[AppStore] CAD hidden');
  },

  /**
   * Toggle visibility
   */
  toggle: () => {
    setAppState('isVisible', !appState.isVisible);
  },

  /**
   * Check if CAD is currently visible
   */
  isOpen: () => appState.isVisible,
  hasBooted: () => appState.hasBootCompleted,

  startBoot: () => {
    setAppState('bootConfig', getBootDefaults());

    if (!appState.bootConfig.enabled) {
      setAppState({
        isBooting: false,
        bootStep: 'System ready',
        bootProgress: 100,
        bootLines: [],
        skipBootRequested: false,
        bootStartedAt: null,
      });
      return;
    }

    setAppState({
      isBooting: true,
      bootStep: 'Powering terminal',
      bootProgress: 4,
      bootLines: [
        'JERICOFX CAD BIOS v1.0',
        'CPU: MDT-9700K @ 3.60GHz',
        'Memory Test: 16384MB OK',
      ],
      skipBootRequested: false,
      bootStartedAt: Date.now(),
    });
  },

  setBootStep: (label: string, progress: number) => {
    setAppState({
      bootStep: label,
      bootProgress: Math.min(100, Math.max(0, progress)),
    });
  },

  pushBootLine: (line: string) => {
    setAppState('bootLines', (current) => {
      const next = [...current, line];
      if (next.length > 14) {
        return next.slice(next.length - 14);
      }
      return next;
    });
  },

  setBootOfficer: (officer: AppState['bootOfficer']) => {
    setAppState('bootOfficer', officer);
  },

  requestBootSkip: () => {
    if (!appState.bootConfig.skippable) {
      return;
    }

    setAppState('skipBootRequested', true);
  },

  completeBoot: () => {
    setAppState({
      hasBootCompleted: true,
      isBooting: false,
      bootStep: 'System ready',
      bootProgress: 100,
      skipBootRequested: false,
      bootStartedAt: null,
    });
  },

  powerCycle: () => {
    setAppState({
      hasBootCompleted: false,
      isBooting: false,
      bootStep: 'Initializing',
      bootProgress: 0,
      bootLines: [],
      skipBootRequested: false,
      bootStartedAt: null,
    });
  },

  updateBootConfig: (partial: Partial<BootConfig>) => {
    setAppState('bootConfig', (current) => {
      const next = {
        ...current,
        ...partial,
        minDurationMs: Math.min(
          10000,
          Math.max(300, Number(partial.minDurationMs ?? current.minDurationMs))
        ),
      };

      saveBootOverrides(next);
      return next;
    });
  },

  isBootEnabled: () => appState.bootConfig.enabled,
  shouldPlayBootSounds: () => appState.bootConfig.soundsEnabled,
};
