import { onNuiMessage } from '~/utils/nuiRouter';
import type {
  VehicleCadToggleData,
  VehicleContextData,
  VehiclePrefillSearchData,
} from '~/types/nuiMessages';

export function initVehicleHandlers(): void {
  onNuiMessage<VehicleContextData>('vehicle:context', async (data) => {
    const { appActions, appState } = await import('~/stores/appStore');
    const { terminalActions, terminalState } = await import('~/stores/terminalStore');

    terminalActions.setVehicleContext(data.isInPoliceVehicle === true);
    terminalActions.setVehicleQuickDockVisible(data.quickDockEnabled !== false);

    if (data.quickLock) {
      terminalActions.setVehicleQuickLock(data.quickLock);
    }

    if (typeof data.vehicleSpeed === 'number') {
      terminalActions.setVehicleSpeed(data.vehicleSpeed);
    }

    if (data.isInPoliceVehicle === true && !appState.isVisible) {
      appActions.show();
      terminalActions.setVehicleOverlayOwned(true);
    }

    if (data.isInPoliceVehicle !== true && terminalState.activeModal === 'VEHICLE_CAD') {
      terminalActions.closeVehicleCAD();
    }

    if (data.isInPoliceVehicle !== true) {
      terminalActions.clearVehicleQuickLock();
      if (terminalState.vehicleOverlayOwned) {
        appActions.hide();
      }
      terminalActions.setVehicleOverlayOwned(false);
    }
  });

  onNuiMessage<VehicleCadToggleData>('vehicle:cadOpen', async () => {
    const { appActions } = await import('~/stores/appStore');
    const { terminalActions } = await import('~/stores/terminalStore');
    const { userActions, userState } = await import('~/stores/userStore');

    appActions.show();
    terminalActions.setVehicleOverlayOwned(true);
    terminalActions.setVehicleContext(true);

    await userActions.init();

    if (userState.needsCallsign) {
      terminalActions.setActiveModal('CALLSIGN_PROMPT', {
        returnModal: 'VEHICLE_CAD',
      });
      return;
    }

    terminalActions.openVehicleCAD();
  });

  onNuiMessage<VehicleCadToggleData>('vehicle:cadClose', async () => {
    const { appActions } = await import('~/stores/appStore');
    const { terminalActions, terminalState } = await import('~/stores/terminalStore');
    terminalActions.closeVehicleCAD();

    if (!terminalState.isInPoliceVehicle && terminalState.vehicleOverlayOwned) {
      appActions.hide();
      terminalActions.setVehicleOverlayOwned(false);
    }
  });

  onNuiMessage<VehiclePrefillSearchData>('vehicle:prefillSearch', async (data) => {
    const { terminalActions } = await import('~/stores/terminalStore');
    if (!data?.plate) {
      return;
    }

    terminalActions.setActiveModal('VEHICLE_CAD', {
      plate: data.plate,
      source: 'vehicle_scan',
    });
  });
}
