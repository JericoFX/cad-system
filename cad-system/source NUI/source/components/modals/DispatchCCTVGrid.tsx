import { For, Show, mergeProps, splitProps } from 'solid-js';
import type { SecurityCamera } from '~/stores/cadStore';
import { Button } from '~/components/ui';

interface DispatchCCTVGridProps {
  cameras: SecurityCamera[];
  cameraLoading: boolean;
  watchingCameraId: string | null;
  formatCameraNumber: (cameraNumber: number) => string;
  onRefresh: () => void;
  onStopView: () => void;
  onWatch: (cameraId: string) => void;
  onToggleStatus: (cameraId: string, status: 'ACTIVE' | 'DISABLED') => void;
  onRemove: (camera: SecurityCamera) => void;
}

export function DispatchCCTVGrid(props: DispatchCCTVGridProps) {
  const merged = mergeProps(
    {
      cameraLoading: false,
      watchingCameraId: null as string | null,
    },
    props
  );
  const [local] = splitProps(merged, [
    'cameras',
    'cameraLoading',
    'watchingCameraId',
    'formatCameraNumber',
    'onRefresh',
    'onStopView',
    'onWatch',
    'onToggleStatus',
    'onRemove',
  ] as const);

  return (
    <>
      <div class="dispatch-cctv-toolbar">
        <Button.Root class="btn" onClick={local.onRefresh} disabled={local.cameraLoading}>
          [{local.cameraLoading ? 'REFRESHING...' : 'REFRESH CCTV'}]
        </Button.Root>
        <Show when={local.watchingCameraId}>
          <Button.Root class="btn btn-warning" onClick={local.onStopView}>
            [STOP VIEW]
          </Button.Root>
        </Show>
      </div>

      <div class="dispatch-cctv-grid">
        <For each={local.cameras}>
          {(camera) => (
            <div class={`dispatch-cctv-card ${local.watchingCameraId === camera.cameraId ? 'is-viewing' : ''}`}>
              <div class="dispatch-cctv-card-header">
                <strong>CAM #{local.formatCameraNumber(camera.cameraNumber)}</strong>
                <span class={`dispatch-cctv-status status-${camera.status.toLowerCase()}`}>{camera.status}</span>
              </div>
              <div class="dispatch-cctv-card-title">
                {camera.label || `Camera ${local.formatCameraNumber(camera.cameraNumber)}`}
              </div>
              <div class="dispatch-cctv-card-meta">{camera.street || 'Unknown street'}</div>
              <div class="dispatch-cctv-card-meta">{camera.zone || 'No zone'}</div>
              <div class="dispatch-cctv-card-actions">
                <Button.Root
                  class="btn btn-primary"
                  disabled={camera.status !== 'ACTIVE'}
                  onClick={() => local.onWatch(camera.cameraId)}
                >
                  [VER]
                </Button.Root>
                <Button.Root
                  class="btn"
                  onClick={() =>
                    local.onToggleStatus(
                      camera.cameraId,
                      camera.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE'
                    )
                  }
                >
                  [{camera.status === 'ACTIVE' ? 'DISABLE' : 'ENABLE'}]
                </Button.Root>
                <Button.Root class="btn btn-danger" onClick={() => local.onRemove(camera)}>
                  [REMOVE]
                </Button.Root>
              </div>
            </div>
          )}
        </For>
        <Show when={local.cameras.length === 0}>
          <div class="empty-state">No security cameras installed yet</div>
        </Show>
      </div>
    </>
  );
}
