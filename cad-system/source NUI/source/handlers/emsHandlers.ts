/**
 * EMS Handlers
 * Handles EMS events from Lua
 */

import { onNuiMessage } from '~/utils/nuiRouter';
import type { 
  EmsAlertCreatedData,
  EmsAlert,
  EmsCriticalPatientData,
  EmsLowStockData,
  EmsBloodRequestCreatedData,
  EmsBloodRequestFulfilledData,
  EmsHandoffCompleteData
} from '~/types/nuiMessages';

export function initEmsHandlers(): void {
  // EMS alert created
  onNuiMessage<EmsAlertCreatedData>('ems:alertCreated', async (data) => {
    console.log('[NUI] EMS alert created:', data.alert.alertId);
    
    const { notificationActions } = await import('~/stores/notificationStore');
    const { cadActions } = await import('~/stores/cadStore');
    
    // Also create a dispatch call for critical alerts
    if (data.alert.priority >= 2) {
      const dispatchCall = {
        callId: `EMS_${data.alert.alertId}`,
        type: 'MEDICAL',
        priority: data.alert.priority,
        title: `EMS: ${data.alert.type}`,
        description: data.alert.message,
        location: data.alert.location ? 
          `${data.alert.location.x.toFixed(1)}, ${data.alert.location.y.toFixed(1)}` : 
          'Unknown',
        coordinates: data.alert.location,
        status: 'PENDING' as const,
        assignedUnits: {},
        createdAt: data.alert.createdAt,
        createdBy: data.alert.createdBy,
      };
      
      cadActions.addDispatchCall(dispatchCall);
    }
    
    notificationActions.notifyCriticalPatient(
      data.alert.alertId,
      data.alert.type,
      data.alert.message
    );
  });
  
  // EMS alert updated
  onNuiMessage<EmsAlert>('ems:alertUpdated', async (data) => {
    console.log('[NUI] EMS alert updated:', data.alertId);

    const { notificationActions } = await import('~/stores/notificationStore');
    notificationActions.notifySystem('EMS Alert Updated', `Alert ${data.alertId} updated`, 'info');
  });
  
  // Critical patient
  onNuiMessage<EmsCriticalPatientData>('ems:criticalPatient', async (data) => {
    console.log('[NUI] Critical patient:', data.patientId);
    
    const { notificationActions } = await import('~/stores/notificationStore');

    // Critical notification
    notificationActions.notifySystem(
      'CRITICAL PATIENT',
      `${data.patientName} - ${data.condition}`,
      'error'
    );
  });
  
  // Low stock
  onNuiMessage<EmsLowStockData>('ems:lowStock', async (data) => {
    console.log('[NUI] Low stock:', data.itemName);
    
    const { notificationActions } = await import('~/stores/notificationStore');

    notificationActions.notifyLowStock(data.itemId, data.itemName, data.currentStock);
  });
  
  // Blood request created
  onNuiMessage<EmsBloodRequestCreatedData>('ems:bloodRequestCreated', async (data) => {
    console.log('[NUI] Blood request created:', data.request.requestId);
    
    const { notificationActions } = await import('~/stores/notificationStore');

    notificationActions.notifySystem(
      'Blood Request',
      `${data.request.bloodType} x${data.request.units} needed at ${data.request.hospital}`,
      'info'
    );
  });
  
  // Blood request fulfilled
  onNuiMessage<EmsBloodRequestFulfilledData>('ems:bloodRequestFulfilled', async (data) => {
    console.log('[NUI] Blood request fulfilled:', data.requestId);
    
    const { notificationActions } = await import('~/stores/notificationStore');

    notificationActions.notifySystem(
      'Blood Request Fulfilled',
      `Request ${data.requestId} has been fulfilled`,
      'success'
    );
  });
  
  // Handoff complete
  onNuiMessage<EmsHandoffCompleteData>('ems:handoffComplete', async (data) => {
    console.log('[NUI] EMS handoff complete:', data.patientId);
    
    const { notificationActions } = await import('~/stores/notificationStore');
    notificationActions.notifySystem(
      'EMS Handoff Complete',
      `${data.patientId}: ${data.fromUnit} -> ${data.toUnit}`,
      'success'
    );
  });
  
  console.log('[NUI Handlers] EMS handlers registered');
}
