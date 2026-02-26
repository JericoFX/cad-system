/**
 * useNui - Main NUI Hook System
 * Entry point for all Lua <-> JS communication
 */

import { onMount, onCleanup } from 'solid-js';
import { 
  initNuiRouter, 
  onNuiMessage,
  isRouterInitialized 
} from '~/utils/nuiRouter';
import type { NuiMessageMap } from '~/types/nuiMessages';

// ============================================================
// 1. BASE HOOK - For any NUI message
// ============================================================

/**
 * Hook to listen for NUI messages from Lua
 * @param action - The message action to listen for
 * @param handler - Handler function for the message data
 */
export function useNui<K extends keyof NuiMessageMap>(
  action: K,
  handler: (data: NuiMessageMap[K]) => void
): void {
  let unsubscribe: (() => void) | null = null;
  
  onMount(() => {
    // Ensure router is initialized
    if (!isRouterInitialized()) {
      initNuiRouter();
    }
    
    unsubscribe = onNuiMessage(action, handler);
  });
  
  onCleanup(() => {
    unsubscribe?.();
  });
}

// ============================================================
// 2. DOMAIN-SPECIFIC HOOKS - Pre-configured for each module
// ============================================================

/**
 * Hook for CAD open/close events
 */
export function useCadEvents(handlers: {
  onOpened?: (data: NuiMessageMap['cad:opened']) => void;
  onClosed?: (data: NuiMessageMap['cad:closed']) => void;
}) {
  if (handlers.onOpened) {
    useNui('cad:opened', handlers.onOpened);
  }
  if (handlers.onClosed) {
    useNui('cad:closed', handlers.onClosed);
  }
}

/**
 * Hook for Dispatch events
 */
export function useDispatchEvents(handlers: {
  onPublicState?: (data: NuiMessageMap['dispatch:publicState']) => void;
}) {
  if (handlers.onPublicState) {
    useNui('dispatch:publicState', handlers.onPublicState);
  }
}

/**
 * Hook for Case events
 */
export function useCaseEvents(handlers: {
  onPublicState?: (data: NuiMessageMap['case:publicState']) => void;
}) {
  if (handlers.onPublicState) {
    useNui('case:publicState', handlers.onPublicState);
  }
}

/**
 * Hook for Evidence events
 */
export function useEvidenceEvents(handlers: {
  onStaged?: (data: NuiMessageMap['evidence:staged']) => void;
  onAnalyzed?: (data: NuiMessageMap['evidence:analyzed']) => void;
  onCollected?: (data: NuiMessageMap['evidence:collected']) => void;
  onTransferred?: (data: NuiMessageMap['evidence:transferred']) => void;
}) {
  if (handlers.onStaged) {
    useNui('evidence:staged', handlers.onStaged);
  }
  if (handlers.onAnalyzed) {
    useNui('evidence:analyzed', handlers.onAnalyzed);
  }
  if (handlers.onCollected) {
    useNui('evidence:collected', handlers.onCollected);
  }
  if (handlers.onTransferred) {
    useNui('evidence:transferred', handlers.onTransferred);
  }
}

/**
 * Hook for EMS events
 */
export function useEmsEvents(handlers: {
  onAlertCreated?: (data: NuiMessageMap['ems:alertCreated']) => void;
  onAlertUpdated?: (data: NuiMessageMap['ems:alertUpdated']) => void;
  onCriticalPatient?: (data: NuiMessageMap['ems:criticalPatient']) => void;
  onLowStock?: (data: NuiMessageMap['ems:lowStock']) => void;
  onBloodRequestCreated?: (data: NuiMessageMap['ems:bloodRequestCreated']) => void;
  onBloodRequestFulfilled?: (data: NuiMessageMap['ems:bloodRequestFulfilled']) => void;
  onHandoffComplete?: (data: NuiMessageMap['ems:handoffComplete']) => void;
}) {
  if (handlers.onAlertCreated) {
    useNui('ems:alertCreated', handlers.onAlertCreated);
  }
  if (handlers.onAlertUpdated) {
    useNui('ems:alertUpdated', handlers.onAlertUpdated);
  }
  if (handlers.onCriticalPatient) {
    useNui('ems:criticalPatient', handlers.onCriticalPatient);
  }
  if (handlers.onLowStock) {
    useNui('ems:lowStock', handlers.onLowStock);
  }
  if (handlers.onBloodRequestCreated) {
    useNui('ems:bloodRequestCreated', handlers.onBloodRequestCreated);
  }
  if (handlers.onBloodRequestFulfilled) {
    useNui('ems:bloodRequestFulfilled', handlers.onBloodRequestFulfilled);
  }
  if (handlers.onHandoffComplete) {
    useNui('ems:handoffComplete', handlers.onHandoffComplete);
  }
}

/**
 * Hook for Forensics events
 */
export function useForensicsEvents(handlers: {
  onAnalysisStarted?: (data: NuiMessageMap['forensics:analysisStarted']) => void;
  onAnalysisCompleted?: (data: NuiMessageMap['forensics:analysisCompleted']) => void;
  onEvidenceCompared?: (data: NuiMessageMap['forensics:evidenceCompared']) => void;
  onWorldTraceFound?: (data: NuiMessageMap['forensics:worldTraceFound']) => void;
  onTraceBagged?: (data: NuiMessageMap['forensics:traceBagged']) => void;
}) {
  if (handlers.onAnalysisStarted) {
    useNui('forensics:analysisStarted', handlers.onAnalysisStarted);
  }
  if (handlers.onAnalysisCompleted) {
    useNui('forensics:analysisCompleted', handlers.onAnalysisCompleted);
  }
  if (handlers.onEvidenceCompared) {
    useNui('forensics:evidenceCompared', handlers.onEvidenceCompared);
  }
  if (handlers.onWorldTraceFound) {
    useNui('forensics:worldTraceFound', handlers.onWorldTraceFound);
  }
  if (handlers.onTraceBagged) {
    useNui('forensics:traceBagged', handlers.onTraceBagged);
  }
}

/**
 * Hook for Photo events
 */
export function usePhotoEvents(handlers: {
  onPreview?: (data: NuiMessageMap['photo:preview']) => void;
  onView?: (data: NuiMessageMap['photo:view']) => void;
  onCaptured?: (data: NuiMessageMap['photo:captured']) => void;
  onReleasedToPress?: (data: NuiMessageMap['photo:releasedToPress']) => void;
}) {
  if (handlers.onPreview) {
    useNui('photo:preview', handlers.onPreview);
  }
  if (handlers.onView) {
    useNui('photo:view', handlers.onView);
  }
  if (handlers.onCaptured) {
    useNui('photo:captured', handlers.onCaptured);
  }
  if (handlers.onReleasedToPress) {
    useNui('photo:releasedToPress', handlers.onReleasedToPress);
  }
}

/**
 * Hook for Fine events
 */
export function useFineEvents(handlers: {
  onCreated?: (data: NuiMessageMap['fine:created']) => void;
  onPaid?: (data: NuiMessageMap['fine:paid']) => void;
}) {
  if (handlers.onCreated) {
    useNui('fine:created', handlers.onCreated);
  }
  if (handlers.onPaid) {
    useNui('fine:paid', handlers.onPaid);
  }
}

/**
 * Hook for Police events
 */
export function usePoliceEvents(handlers: {
  onJailTransferLogged?: (data: NuiMessageMap['police:jailTransferLogged']) => void;
}) {
  if (handlers.onJailTransferLogged) {
    useNui('police:jailTransferLogged', handlers.onJailTransferLogged);
  }
}

/**
 * Hook for notification events
 */
export function useNotificationEvents(handlers: {
  onShow?: (data: NuiMessageMap['notification:show']) => void;
}) {
  if (handlers.onShow) {
    useNui('notification:show', handlers.onShow);
  }
}

/**
 * Hook for offline sync events
 */
export function useOfflineSync(handlers: {
  onSync?: (data: NuiMessageMap['cad:syncOffline']) => void;
}) {
  if (handlers.onSync) {
    useNui('cad:syncOffline', handlers.onSync);
  }
}

// ============================================================
// 3. SYSTEM INITIALIZATION
// ============================================================

/**
 * Initialize the complete NUI system
 * Should be called once at app startup
 */
export function initNuiSystem(): void {
  if (isRouterInitialized()) {
    console.log('[NUI System] Already initialized');
    return;
  }
  
  // Initialize router
  initNuiRouter();
  
  // Register automatic handlers (import dynamically to avoid circular deps)
  import('~/handlers').then(({ initAllNuiHandlers }) => {
    initAllNuiHandlers();
    console.log('[NUI System] Fully initialized with auto-handlers');
  });
}

// ============================================================
// 4. RE-EXPORTS
// ============================================================

export { onNuiMessage, isRouterInitialized } from '~/utils/nuiRouter';
export type { NuiMessageMap } from '~/types/nuiMessages';
