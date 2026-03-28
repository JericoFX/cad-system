import { onNuiMessage } from '~/utils/nuiRouter';
import type { PhotoMetadata as StorePhotoMetadata } from '~/stores/photoStore';
import type {
  PhotoPreviewData,
  PhotoViewData,
  PhotoCapturedData,
  PhotoReleasedToPressData
} from '~/types/nuiMessages';

const recentlyHandledCapture = new Map<string, number>();

function shouldHandleCapture(photoId: string): boolean {
  const now = Date.now();
  const last = recentlyHandledCapture.get(photoId) || 0;
  recentlyHandledCapture.set(photoId, now);

  for (const [key, timestamp] of recentlyHandledCapture.entries()) {
    if (now - timestamp > 30000) {
      recentlyHandledCapture.delete(key);
    }
  }

  return (now - last) > 1000;
}

function normalizeCapturedPhoto(photo: PhotoCapturedData['photo']): StorePhotoMetadata {
  return {
    photoId: photo.photoId,
    photoUrl: photo.photoUrl,
    job: photo.job,
    takenBy: photo.takenBy || 'Unknown',
    takenByCitizenId: photo.takenByCitizenId || 'UNKNOWN',
    takenAt: photo.takenAt || new Date().toISOString(),
    location: photo.location || { x: 0, y: 0, z: 0 },
    description: photo.description || '',
    fov: photo.fov || {
      hit: false,
      distance: 0,
    },
    isEvidence: photo.isEvidence,
    attachedCaseId: photo.attachedCaseId,
  };
}

export function initPhotoHandlers(): void {
  onNuiMessage<PhotoPreviewData>('photo:preview', async (data) => {
    const { photoActions } = await import('~/stores/photoStore');
    const { viewerActions } = await import('~/stores/viewerStore');

    const previewPhoto = {
      photoId: `PREVIEW_${Date.now()}`,
      photoUrl: data.imageUrl,
      job: data.job,
      takenBy: 'SYSTEM',
      takenByCitizenId: 'SYSTEM',
      takenAt: new Date().toISOString(),
      location: data.location,
      description: '',
      fov: data.fov,
    };

    photoActions.setCurrentPhoto(previewPhoto);
    viewerActions.openImage(data.imageUrl, `${data.job === 'police' ? 'Evidence' : 'Press'} Preview`);
  });

  onNuiMessage<PhotoViewData>('photo:view', async (data) => {
    const { viewerActions } = await import('~/stores/viewerStore');

    viewerActions.openImage(data.url, data.metadata.description || 'Photo');
  });

  onNuiMessage<PhotoCapturedData>('photo:captured', async (data) => {
    const { photoActions } = await import('~/stores/photoStore');
    const { terminalActions } = await import('~/stores/terminalStore');
    const { notificationActions } = await import('~/stores/notificationStore');

    const photo = normalizeCapturedPhoto(data.photo);
    photoActions.addCapturedPhoto(photo);
    photoActions.setCurrentPhoto(photo);

    if (shouldHandleCapture(photo.photoId)) {
      terminalActions.setActiveModal('PHOTO_PREVIEW', {
        photoId: photo.photoId,
        photoUrl: photo.photoUrl,
        job: photo.job,
        location: photo.location,
        fov: photo.fov || {
          hit: false,
          distance: 0,
        },
      });
    }

    notificationActions.notifySystem(
      'Photo Captured',
      `Photo ${photo.photoId} saved`,
      'success'
    );
  });

  onNuiMessage<PhotoReleasedToPressData>('photo:releasedToPress', async (data) => {
    const { notificationActions } = await import('~/stores/notificationStore');

    notificationActions.notifySystem(
      'Photo Released',
      `Photo ${data.photoId} released to press`,
      'info'
    );
  });
}
