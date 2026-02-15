/**
 * Fine Handlers
 * Handles fine/ticket events from Lua
 */

import { onNuiMessage } from '~/utils/nuiRouter';
import type { 
  FineCreatedData,
  FinePaidData
} from '~/types/nuiMessages';

export function initFineHandlers(): void {
  // Fine created
  onNuiMessage<FineCreatedData>('fine:created', async (data) => {
    console.log('[NUI] Fine created:', data.fine.fineId);
    
    const { cadActions } = await import('~/stores/cadStore');
    const { notificationActions } = await import('~/stores/notificationStore');
    
    // Add fine to store
    cadActions.addFine(data.fine);
    
    // Notification
    const targetType = data.fine.targetType === 'PERSON' ? 'person' : 'vehicle';
    notificationActions.notifySystem(
      'Fine Issued',
      `${data.fine.fineCode} - $${data.fine.amount} to ${targetType} ${data.fine.targetName}`,
      'info'
    );
    
    // If attached to a case, add reference
    if (data.fine.attachedCaseId) {
      // Case reference would be handled by the server
    }
  });
  
  // Fine paid
  onNuiMessage<FinePaidData>('fine:paid', async (data) => {
    console.log('[NUI] Fine paid:', data.fineId);
    
    const { cadActions } = await import('~/stores/cadStore');
    const { notificationActions } = await import('~/stores/notificationStore');
    
    // Update fine status
    cadActions.updateFine(data.fineId, {
      paid: true,
      paidAt: data.paidAt,
      paidMethod: data.paidMethod,
      status: 'PAID',
    });
    
    notificationActions.notifySystem(
      'Fine Paid',
      `Fine ${data.fineId} has been paid`,
      'success'
    );
  });
  
  console.log('[NUI Handlers] Fine handlers registered');
}
