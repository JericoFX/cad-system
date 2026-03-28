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
  onNuiMessage<EmsAlertCreatedData>('ems:alertCreated', async (data) => {
    const alertTitle = data.alert.title || data.alert.type || 'Medical Alert';
    const alertDescription = data.alert.description || data.alert.message || '';
    const alertCoordinates = data.alert.coords || data.alert.location;
    const alertSeverity = String(data.alert.severity || '').toUpperCase();
    const priority =
      alertSeverity === 'HIGH'
        ? 1
        : alertSeverity === 'LOW'
          ? 3
          : Math.max(1, Math.min(3, Number(data.alert.priority || 2)));

    const { notificationActions } = await import('~/stores/notificationStore');
    const { cadActions } = await import('~/stores/cadStore');

    if (priority <= 2) {
      const dispatchCall = {
        callId: `EMS_${data.alert.alertId}`,
        type: 'MEDICAL',
        priority,
        title: `EMS: ${alertTitle}`,
        description: alertDescription,
        location: alertCoordinates ?
          `${alertCoordinates.x.toFixed(1)}, ${alertCoordinates.y.toFixed(1)}` :
          'Unknown',
        coordinates: alertCoordinates,
        status: 'PENDING' as const,
        assignedUnits: {},
        createdAt: data.alert.createdAt,
        createdBy: data.alert.createdBy || 'EMS',
      };

      cadActions.addDispatchCall(dispatchCall);
    }

    notificationActions.notifyCriticalPatient(
      data.alert.alertId,
      alertTitle,
      alertDescription
    );
  });

  onNuiMessage<EmsAlert>('ems:alertUpdated', async (data) => {
    const { notificationActions } = await import('~/stores/notificationStore');
    notificationActions.notifySystem('EMS Alert Updated', `Alert ${data.alertId} updated`, 'info');
  });

  onNuiMessage<EmsCriticalPatientData>('ems:criticalPatient', async (data) => {
    const { notificationActions } = await import('~/stores/notificationStore');

    notificationActions.notifySystem(
      'CRITICAL PATIENT',
      `${data.patientName} - ${data.condition}`,
      'error'
    );
  });

  onNuiMessage<EmsLowStockData>('ems:lowStock', async (data) => {
    const { notificationActions } = await import('~/stores/notificationStore');

    notificationActions.notifyLowStock(data.itemId, data.itemName, data.currentStock);
  });

  onNuiMessage<EmsBloodRequestCreatedData>('ems:bloodRequestCreated', async (data) => {
    const { notificationActions } = await import('~/stores/notificationStore');

    notificationActions.notifySystem(
      'Blood Request',
      `${data.request.personName} (${data.request.citizenId || 'UNKNOWN'}) - ${data.request.reason}`,
      'info'
    );
  });

  onNuiMessage<EmsBloodRequestFulfilledData>('ems:bloodRequestFulfilled', async (data) => {
    const { notificationActions } = await import('~/stores/notificationStore');

    notificationActions.notifySystem(
      'Blood Request Fulfilled',
      `Request ${data.requestId} has been fulfilled`,
      'success'
    );
  });

  onNuiMessage<EmsHandoffCompleteData>('ems:handoffComplete', async (data) => {
    const { notificationActions } = await import('~/stores/notificationStore');
    notificationActions.notifySystem(
      'EMS Handoff Complete',
      `${data.patientId}: ${data.fromUnit} -> ${data.toUnit}`,
      'success'
    );
  });
}
