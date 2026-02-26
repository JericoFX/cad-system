/**
 * Police Handlers
 * Handles police-specific events from Lua
 */

import { onNuiMessage } from '~/utils/nuiRouter';
import type { 
  PoliceJailTransferLoggedData
} from '~/types/nuiMessages';

export function initPoliceHandlers(): void {
  // Jail transfer logged
  onNuiMessage<PoliceJailTransferLoggedData>('police:jailTransferLogged', async (data) => {
    console.log('[NUI] Jail transfer logged:', data.transfer.transferId);
    
    const { notificationActions } = await import('~/stores/notificationStore');
    
    // Add jail transfer record (would need to add to cadStore)
    // For now, just notify
    notificationActions.notifySystem(
      'Jail Transfer',
      `${data.transfer.inmateName} transferred to ${data.transfer.toFacility}`,
      'info'
    );
    
    // Create activity log entry
    const { auditActions } = await import('~/stores/auditStore');
    auditActions.logCommand(
      'jail-transfer',
      [data.transfer.inmateId, data.transfer.toFacility],
      'success',
      `Transfer logged: ${data.transfer.transferId}`
    );
  });
  
  console.log('[NUI Handlers] Police handlers registered');
}
