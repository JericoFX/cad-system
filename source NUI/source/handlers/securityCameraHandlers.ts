import { onNuiMessage } from '~/utils/nuiRouter';
import type {
  CameraCreatedData,
  CameraUpdatedData,
  CameraRemovedData,
  CameraViewStartedData,
  CameraViewStoppedData,
} from '~/types/nuiMessages';

export function initSecurityCameraHandlers(): void {
  onNuiMessage<CameraCreatedData>('camera:created', async (data) => {
    const { cadActions } = await import('~/stores/cadStore');
    cadActions.upsertSecurityCamera(data.camera);
  });

  onNuiMessage<CameraUpdatedData>('camera:updated', async (data) => {
    const { cadActions } = await import('~/stores/cadStore');
    cadActions.upsertSecurityCamera(data.camera);
  });

  onNuiMessage<CameraRemovedData>('camera:removed', async (data) => {
    const { cadActions } = await import('~/stores/cadStore');
    cadActions.removeSecurityCamera(data.cameraId);
  });

  onNuiMessage<CameraViewStartedData>('camera:viewStarted', async (data) => {
    const { terminalActions } = await import('~/stores/terminalStore');
    terminalActions.addLine(`Viewing camera #${String(data.camera.cameraNumber).padStart(4, '0')}`, 'system');
  });

  onNuiMessage<CameraViewStoppedData>('camera:viewStopped', async () => {
    const { terminalActions } = await import('~/stores/terminalStore');
    terminalActions.addLine('Camera view stopped', 'system');
  });
}
