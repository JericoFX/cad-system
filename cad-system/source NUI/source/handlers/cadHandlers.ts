/**
 * CAD Handlers
 * Handles CAD open/close events from Lua
 */

import { onNuiMessage } from '~/utils/nuiRouter';
import { appActions } from '~/stores/appStore';
import { userActions, userState } from '~/stores/userStore';
import { sessionState } from '~/stores/sessionStore';
import type { 
  CadOpenedData, 
  CadClosedData,
  NuiMessageMap 
} from '~/types/nuiMessages';

export function initCadHandlers(): void {
  // CAD Opened
  onNuiMessage<CadOpenedData>('cad:opened', async (data) => {
    console.log('[NUI] CAD opened:', data);
    
    // Show the entire CAD application
    appActions.show();
    
    // Import stores dynamically to avoid circular dependencies
    const { sessionActions } = await import('~/stores/sessionStore');
    const { terminalActions } = await import('~/stores/terminalStore');
    
    // Save terminal context FIRST (before callsign check)
    // This ensures we have the context even if user needs to set callsign
    if (data.terminalId) {
      sessionActions.setTerminalContext({
        terminalId: data.terminalId,
        location: data.location,
        hasContainer: data.hasContainer,
        hasReader: data.hasReader,
      });
      console.log('[NUI] Terminal context saved:', data.terminalId);
    }
    
    // Initialize user first (this loads callsign)
    await userActions.init();
    
    // Check if user needs callsign - must check after init completes
    const needsCallsign = !userState.callsign || (userState.callsign && userState.callsign.startsWith('B-'));
    
    console.log('[NUI] Callsign check:', { 
      callsign: userState.callsign, 
      needsCallsign,
      isAuthenticated: userState.isAuthenticated 
    });
    
    if (needsCallsign || userState.needsCallsign) {
      console.log('[NUI] User needs callsign, showing prompt');
      terminalActions.setActiveModal('CALLSIGN_PROMPT');
      return; // Don't initialize rest until callsign is set
    }
    
    // Continue with normal initialization
    await continueCadInit(data);
  });
  
  // CAD Closed
  onNuiMessage<CadClosedData>('cad:closed', async (data) => {
    console.log('[NUI] CAD closed:', data);
    
    // Hide the entire CAD application
    appActions.hide();
    
    // Import stores dynamically to avoid circular dependencies
    const { homeActions } = await import('~/stores/homeStore');
    const { sessionActions } = await import('~/stores/sessionStore');
    const { terminalActions } = await import('~/stores/terminalStore');
    
    // Reset home screen
    homeActions.reset();
    
    // Clear terminal context
    sessionActions.clearTerminalContext();
    
    // Clear modal state
    terminalActions.setActiveModal(null);
  });
  
  console.log('[NUI Handlers] CAD handlers registered');
}

/**
 * Manually trigger CAD open (for testing)
 */
export function openCad(): void {
  appActions.show();
}

/**
 * Manually trigger CAD close (for testing)
 */
export function closeCad(): void {
  appActions.hide();
}

/**
 * Continue CAD initialization after callsign is set
 */
export async function continueCadInit(data: CadOpenedData): Promise<void> {
  const { homeActions } = await import('~/stores/homeStore');
  const { sessionActions } = await import('~/stores/sessionStore');
  const { terminalActions } = await import('~/stores/terminalStore');
  
  // Clear the callsign prompt modal
  terminalActions.setActiveModal(null);
  
  // Initialize home screen
  homeActions.init();
  
  // Terminal context is already set in initCadHandlers before callsign check
  // Only update if we have new data and context wasn't set
  if (data.terminalId && !sessionState.terminalId) {
    sessionActions.setTerminalContext({
      terminalId: data.terminalId,
      location: data.location,
      hasContainer: data.hasContainer,
      hasReader: data.hasReader,
    });
  }
}
