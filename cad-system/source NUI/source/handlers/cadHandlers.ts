/**
 * CAD Handlers
 * Handles CAD open/close events from Lua
 */

import { onNuiMessage } from '~/utils/nuiRouter';
import { appActions } from '~/stores/appStore';
import { userActions, userState } from '~/stores/userStore';
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
    const { homeActions } = await import('~/stores/homeStore');
    const { sessionActions } = await import('~/stores/sessionStore');
    const { terminalActions } = await import('~/stores/terminalStore');
    
    // Initialize user first (this loads callsign)
    await userActions.init();
    
    // Check if user needs callsign
    if (userState.needsCallsign) {
      console.log('[NUI] User needs callsign, showing prompt');
      terminalActions.setActiveModal('CALLSIGN_PROMPT');
      return; // Don't initialize rest until callsign is set
    }
    
    // Initialize home screen with user role
    homeActions.init();
    
    // Set terminal context
    if (data.terminalId) {
      sessionActions.setTerminalContext({
        terminalId: data.terminalId,
        location: data.location,
        hasContainer: data.hasContainer,
        hasReader: data.hasReader,
      });
    }
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
  
  // Set terminal context
  if (data.terminalId) {
    sessionActions.setTerminalContext({
      terminalId: data.terminalId,
      location: data.location,
      hasContainer: data.hasContainer,
      hasReader: data.hasReader,
    });
  }
}
