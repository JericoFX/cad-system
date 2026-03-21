import { createMemo, createSignal, onCleanup, onMount, Show, createEffect } from 'solid-js';
import { terminalActions } from '~/stores/terminalStore';
import { cadActions, cadState, type SecurityCamera } from '~/stores/cadStore';
import { fetchNui } from '~/utils/fetchNui';
import { useNui } from '~/hooks/useNui';
import { Button, Modal } from '~/components/ui';
import {
  cameraArrayToRecord,
  type CameraListResponse,
  type CameraWatchResponse,
  type CameraStatusResponse,
  type CameraRemoveResponse,
} from './dispatchTable.utils';
import { sortCameraGrid } from './dispatchTable.selectors';
import { DispatchCCTVGrid } from './DispatchCCTVGrid';

export function SecurityCameraPanel() {
  const [cameraLoading, setCameraLoading] = createSignal(false);
  const [watchingCameraId, setWatchingCameraId] = createSignal<string | null>(null);

  useNui('camera:viewStarted', (data) => {
    if (!data || !data.camera || !data.camera.cameraId) {
      return;
    }
    setWatchingCameraId(data.camera.cameraId);
  });

  useNui('camera:viewStopped', () => {
    setWatchingCameraId(null);
  });

  const cameraGrid = createMemo(() => sortCameraGrid(Object.values(cadState.securityCameras)));

  const activeWatchedCamera = createMemo(() => {
    const cameraId = watchingCameraId();
    if (!cameraId) return null;
    return cadState.securityCameras[cameraId] || null;
  });

  const formatCameraNumber = (cameraNumber: number) => String(cameraNumber || 0).padStart(4, '0');

  const getMockCameraBackground = (camera: SecurityCamera | null) => {
    if (camera) {
      return `/cctv-mock.svg?cam=${camera.cameraNumber}`;
    }
    return '/cctv-mock.svg';
  };

  const refreshCameraGrid = async (silent = false) => {
    setCameraLoading(true);
    try {
      const response = await fetchNui<CameraListResponse>('cad:cameras:list', {});
      if (!response || response.ok !== true) {
        terminalActions.addLine(
          `Failed to refresh CCTV grid: ${response?.error || 'unknown_error'}`,
          'error'
        );
        return;
      }

      const cameraList = Array.isArray(response.cameras) ? response.cameras : [];
      cadActions.setSecurityCameras(cameraArrayToRecord(cameraList));

      if (!silent) {
        terminalActions.addLine(`CCTV grid refreshed (${cameraList.length})`, 'system');
      }
    } catch (error) {
      terminalActions.addLine(`Failed to refresh CCTV grid: ${String(error)}`, 'error');
    } finally {
      setCameraLoading(false);
    }
  };

  const watchCamera = async (cameraId: string) => {
    try {
      const response = await fetchNui<CameraWatchResponse>('cad:cameras:watch', { cameraId });
      if (!response || response.ok !== true || !response.camera) {
        terminalActions.addLine(
          `Cannot open camera feed: ${response?.error || 'unknown_error'}`,
          'error'
        );
        return;
      }

      setWatchingCameraId(response.camera.cameraId);
      terminalActions.addLine(
        `Viewing camera #${formatCameraNumber(response.camera.cameraNumber)} (${response.camera.label})`,
        'system'
      );
    } catch (error) {
      terminalActions.addLine(`Cannot open camera feed: ${String(error)}`, 'error');
    }
  };

  const stopWatchingCamera = async (silent = false) => {
    if (!watchingCameraId()) {
      return;
    }

    try {
      await fetchNui<{ ok: boolean; error?: string }>('cad:cameras:stopWatch', {});
      if (!silent) {
        terminalActions.addLine('Camera feed closed', 'system');
      }
    } catch (error) {
      terminalActions.addLine(`Cannot close camera feed: ${String(error)}`, 'error');
    } finally {
      setWatchingCameraId(null);
    }
  };

  const setCameraStatus = async (cameraId: string, status: 'ACTIVE' | 'DISABLED') => {
    try {
      const response = await fetchNui<CameraStatusResponse>('cad:cameras:setStatus', {
        cameraId,
        status,
      });

      if (!response || response.ok !== true || !response.camera) {
        terminalActions.addLine(
          `Cannot update camera status: ${response?.error || 'unknown_error'}`,
          'error'
        );
        return;
      }

      cadActions.upsertSecurityCamera(response.camera);
      terminalActions.addLine(
        `Camera #${formatCameraNumber(response.camera.cameraNumber)} set to ${response.camera.status}`,
        'system'
      );

      if (status === 'DISABLED' && watchingCameraId() === response.camera.cameraId) {
        await stopWatchingCamera(true);
      }
    } catch (error) {
      terminalActions.addLine(`Cannot update camera status: ${String(error)}`, 'error');
    }
  };

  const removeCamera = async (camera: SecurityCamera) => {
    const confirmed = window.confirm(
      `Remove camera #${formatCameraNumber(camera.cameraNumber)} (${camera.label})?`
    );
    if (!confirmed) {
      return;
    }

    try {
      const response = await fetchNui<CameraRemoveResponse>('cad:cameras:remove', {
        cameraId: camera.cameraId,
      });

      if (!response || response.ok !== true || !response.cameraId) {
        terminalActions.addLine(`Cannot remove camera: ${response?.error || 'unknown_error'}`, 'error');
        return;
      }

      cadActions.removeSecurityCamera(response.cameraId);
      terminalActions.addLine(
        `Camera #${formatCameraNumber(camera.cameraNumber)} removed from grid`,
        'system'
      );

      if (watchingCameraId() === response.cameraId) {
        await stopWatchingCamera(true);
      }
    } catch (error) {
      terminalActions.addLine(`Cannot remove camera: ${String(error)}`, 'error');
    }
  };

  const closePanel = () => {
    void stopWatchingCamera(true);
    terminalActions.setActiveModal(null);
  };

  createEffect(() => {
    const cameraId = watchingCameraId();
    if (!cameraId) return;
    const camera = cadState.securityCameras[cameraId];
    if (!camera || camera.status !== 'ACTIVE') {
      void stopWatchingCamera(true);
    }
  });

  onMount(() => {
    void refreshCameraGrid(true);
  });

  onCleanup(() => {
    void stopWatchingCamera(true);
  });

  return (
    <Modal.Root onClose={closePanel} useContentWrapper={false}>
      <div class="modal-content dispatch-table-modal dispatch-v2-modal" onClick={(e) => e.stopPropagation()}>
        <div class="modal-header dispatch-v2-header">
          <h2>=== SECURITY CAMERA PANEL ===</h2>
          <div class="dispatch-v2-header-actions">
            <button class="modal-close" onClick={closePanel}>[X]</button>
          </div>
        </div>

        <Show when={watchingCameraId()}>
          <div class="dispatch-cctv-crt-overlay">
            <div
              class="dispatch-cctv-mock-feed"
              style={{
                'background-image': `url(${getMockCameraBackground(activeWatchedCamera())})`,
              }}
            />
            <div class="dispatch-cctv-crt-scanlines" />
            <div class="dispatch-cctv-crt-label">CCTV LIVE FEED</div>
            <Show when={activeWatchedCamera()}>
              {(cameraAccessor) => {
                const camera = cameraAccessor();
                return (
                  <div class="dispatch-cctv-crt-meta">
                     CAM #{formatCameraNumber(camera.cameraNumber)} | {camera.street || 'Street unavailable'}
                  </div>
                );
              }}
            </Show>
          </div>
        </Show>

        <div style={{ padding: '12px' }}>
          <div class="dispatch-v2-section-title">CCTV GRID ({cameraGrid().length})</div>
          <DispatchCCTVGrid
            cameras={cameraGrid()}
            cameraLoading={cameraLoading()}
            watchingCameraId={watchingCameraId()}
            formatCameraNumber={formatCameraNumber}
            onRefresh={() => void refreshCameraGrid()}
            onStopView={() => void stopWatchingCamera()}
            onWatch={(cameraId) => void watchCamera(cameraId)}
            onToggleStatus={(cameraId, status) => void setCameraStatus(cameraId, status)}
            onRemove={(camera) => void removeCamera(camera)}
          />
        </div>

        <div class="modal-footer">
          <Button.Root class="btn" onClick={closePanel}>[CLOSE]</Button.Root>
        </div>
      </div>
    </Modal.Root>
  );
}
