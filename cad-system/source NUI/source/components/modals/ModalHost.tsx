import { Dynamic } from 'solid-js/web';
import { Show, Suspense, createMemo } from 'solid-js';
import { terminalState } from '~/stores/terminalStore';
import { isModalId, modalRegistry, type PhotoPreviewData } from './modalRegistry';

function ModalLoadingFallback() {
  return (
    <div class='modal-overlay'>
      <div class='modal-content'>
        <div class='modal-header'>
          <h2>LOADING...</h2>
        </div>
      </div>
    </div>
  );
}

export function ModalHost() {
  const photoPreviewData = createMemo<PhotoPreviewData | null>(() => {
    if (terminalState.activeModal !== 'PHOTO_PREVIEW') {
      return null;
    }

    const payload = terminalState.modalData as {
      photoId?: string;
      photoUrl?: string;
      job?: 'police' | 'reporter';
      description?: string;
      location?: { x?: number; y?: number; z?: number };
      fov?: {
        hit?: boolean;
        hitCoords?: { x?: number; y?: number; z?: number };
        distance?: number;
        entityType?: string;
      };
    } | null;

    if (!payload?.photoId || !payload.photoUrl || !payload.job) {
      return null;
    }

    const location = payload.location || { x: 0, y: 0, z: 0 };
    return {
      photoId: payload.photoId,
      photoUrl: payload.photoUrl,
      job: payload.job,
      description: payload.description,
      location: {
        x: Number(location.x) || 0,
        y: Number(location.y) || 0,
        z: Number(location.z) || 0,
      },
      fov: {
        hit: payload.fov?.hit === true,
        hitCoords: payload.fov?.hitCoords
          ? {
              x: Number(payload.fov.hitCoords.x) || 0,
              y: Number(payload.fov.hitCoords.y) || 0,
              z: Number(payload.fov.hitCoords.z) || 0,
            }
          : undefined,
        distance: Number(payload.fov?.distance) || 0,
        entityType: payload.fov?.entityType,
      },
    };
  });

  const activeModal = createMemo(() => {
    if (!isModalId(terminalState.activeModal)) {
      return null;
    }

    const entry = modalRegistry[terminalState.activeModal];
    if (entry.enabled && !entry.enabled()) {
      return null;
    }

    const props = entry.getProps
      ? entry.getProps({
          photoPreviewData: photoPreviewData(),
        })
      : {};

    if (props === null) {
      return null;
    }

    return {
      component: entry.component,
      props,
    };
  });

  return (
    <Show when={activeModal()}>
      {(resolvedModal) => (
        <Suspense fallback={<ModalLoadingFallback />}>
          <Dynamic component={resolvedModal().component} {...resolvedModal().props} />
        </Suspense>
      )}
    </Show>
  );
}
