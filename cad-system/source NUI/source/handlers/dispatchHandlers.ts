/**
 * Dispatch Handlers
 * Handles dispatch events from Lua
 */

import { onNuiMessage } from '~/utils/nuiRouter';
import type { 
  DispatchCallCreatedData,
  DispatchCallUpdatedData,
  DispatchCallClosedData,
  DispatchCallAssignedData,
  DispatchUnitStatusChangedData,
  DispatchUnitPositionUpdatedData
} from '~/types/nuiMessages';

export function initDispatchHandlers(): void {
  // Dispatch call created
  onNuiMessage<DispatchCallCreatedData>('dispatch:callCreated', async (data) => {
    console.log('[NUI] Dispatch call created:', data.call.callId);
    
    const { cadActions } = await import('~/stores/cadStore');
    const { notificationActions } = await import('~/stores/notificationStore');
    
    // Add call to store
    cadActions.addDispatchCall(data.call);
    
    // Show notification
    notificationActions.notifyDispatch(data);
  });
  
  // Dispatch call updated
  onNuiMessage<DispatchCallUpdatedData>('dispatch:callUpdated', async (data) => {
    console.log('[NUI] Dispatch call updated:', data.callId);
    
    const { cadActions } = await import('~/stores/cadStore');
    cadActions.updateDispatchCall(data.callId, data.changes);
  });
  
  // Dispatch call closed
  onNuiMessage<DispatchCallClosedData>('dispatch:callClosed', async (data) => {
    console.log('[NUI] Dispatch call closed:', data.callId);
    
    const { cadActions } = await import('~/stores/cadStore');
    const { notificationActions } = await import('~/stores/notificationStore');
    
    // Remove call from store
    cadActions.removeDispatchCall(data.callId);
    
    // Notify
    notificationActions.notifySystem(
      'Call Closed',
      `Call ${data.callId} has been closed`,
      'info'
    );
  });
  
  // Dispatch call assigned
  onNuiMessage<DispatchCallAssignedData>('dispatch:callAssigned', async (data) => {
    console.log('[NUI] Dispatch call assigned:', data.callId, 'to', data.unitId);
    
    const { cadActions } = await import('~/stores/cadStore');
    
    // Update call with assigned unit
    cadActions.updateDispatchCall(data.callId, {
      assignedUnits: {
        [data.unitId]: { assignedAt: data.assignedAt }
      }
    });
    
    // Update unit's current call
    cadActions.updateDispatchUnit(data.unitId, {
      currentCall: data.callId
    });
  });
  
  // Dispatch unit status changed
  onNuiMessage<DispatchUnitStatusChangedData>('dispatch:unitStatusChanged', async (data) => {
    console.log('[NUI] Unit status changed:', data.unitId, data.newStatus);
    
    const { cadActions } = await import('~/stores/cadStore');
    cadActions.updateDispatchUnit(data.unitId, { status: data.newStatus as any });
  });
  
  // Dispatch unit position updated
  onNuiMessage<DispatchUnitPositionUpdatedData>('dispatch:unitPositionUpdated', async (data) => {
    const { cadActions } = await import('~/stores/cadStore');
    
    // Update unit position (throttled to avoid excessive updates)
    cadActions.updateDispatchUnit(data.unitId, {
      location: { x: data.x, y: data.y, z: data.z }
    });
  });
  
  console.log('[NUI Handlers] Dispatch handlers registered');
}
