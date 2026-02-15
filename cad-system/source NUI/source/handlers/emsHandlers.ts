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
    
    const { emsActions } = await import('~/stores/emsStore');
    const { notificationActions } = await import('~/stores/notificationStore');
    const { cadActions } = await import('~/stores/cadStore');
    
    // Add alert to EMS store
    emsActions.addAlert(data.alert);
    
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
    
    // Critical notification
    notificationActions.notifyEMS(data);
  });
  
  // EMS alert updated
  onNuiMessage<EmsAlert>('ems:alertUpdated', async (data) => {
    console.log('[NUI] EMS alert updated:', data.alertId);
    
    const { emsActions } = await import('~/stores/emsStore');
    emsActions.updateAlert(data);
  });
  
  // Critical patient
  onNuiMessage<EmsCriticalPatientData>('ems:criticalPatient', async (data) => {
    console.log('[NUI] Critical patient:', data.patientId);
    
    const { emsActions } = await import('~/stores/emsStore');
    const { notificationActions } = await import('~/stores/notificationStore');
    
    // Update patient status
    emsActions.updatePatientStatus(data.patientId, {
      condition: data.condition,
      location: data.location,
      hospital: data.hospital,
      lastUpdated: data.updatedAt,
    });
    
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
    
    const { emsActions } = await import('~/stores/emsStore');
    const { notificationActions } = await import('~/stores/notificationStore');
    
    emsActions.updateInventoryStock(data.itemId, data.currentStock);
    
    notificationActions.notifySystem(
      'Low Stock Alert',
      `${data.itemName}: ${data.currentStock} remaining`,
      'warning'
    );
  });
  
  // Blood request created
  onNuiMessage<EmsBloodRequestCreatedData>('ems:bloodRequestCreated', async (data) => {
    console.log('[NUI] Blood request created:', data.request.requestId);
    
    const { emsActions } = await import('~/stores/emsStore');
    const { notificationActions } = await import('~/stores/notificationStore');
    
    emsActions.addBloodRequest(data.request);
    
    notificationActions.notifySystem(
      'Blood Request',
      `${data.request.bloodType} x${data.request.units} needed at ${data.request.hospital}`,
      'info'
    );
  });
  
  // Blood request fulfilled
  onNuiMessage<EmsBloodRequestFulfilledData>('ems:bloodRequestFulfilled', async (data) => {
    console.log('[NUI] Blood request fulfilled:', data.requestId);
    
    const { emsActions } = await import('~/stores/emsStore');
    const { notificationActions } = await import('~/stores/notificationStore');
    
    emsActions.updateBloodRequest(data.requestId, {
      status: 'FULFILLED',
      fulfilledBy: data.fulfilledBy,
      fulfilledAt: data.fulfilledAt,
    });
    
    notificationActions.notifySystem(
      'Blood Request Fulfilled',
      `Request ${data.requestId} has been fulfilled`,
      'success'
    );
  });
  
  // Handoff complete
  onNuiMessage<EmsHandoffCompleteData>('ems:handoffComplete', async (data) => {
    console.log('[NUI] EMS handoff complete:', data.patientId);
    
    const { emsActions } = await import('~/stores/emsStore');
    
    emsActions.recordHandoff(data.patientId, {
      fromUnit: data.fromUnit,
      toUnit: data.toUnit,
      completedAt: data.completedAt,
    });
  });
  
  console.log('[NUI Handlers] EMS handlers registered');
}
