/**
 * Photo Handlers
 * Handles photo events from Lua
 */

import { onNuiMessage } from '~/utils/nuiRouter';
import type { 
  PhotoPreviewData,
  PhotoViewData,
  PhotoCapturedData,
  PhotoReleasedToPressData
} from '~/types/nuiMessages';

export function initPhotoHandlers(): void {
  // Photo preview (from camera capture)
  onNuiMessage<PhotoPreviewData>('photo:preview', async (data) => {
    console.log('[NUI] Photo preview');
    
    const { photoActions } = await import('~/stores/photoStore');
    const { terminalActions } = await import('~/stores/terminalStore');
    
    // Set preview data
    photoActions.setPreviewData({
      imageUrl: data.imageUrl,
      isBase64: data.isBase64,
      location: data.location,
      fov: data.fov,
      job: data.job,
    });
    
    // Open photo preview modal
    terminalActions.setActiveModal('PHOTO_PREVIEW');
  });
  
  // Photo view (from inventory item)
  onNuiMessage<PhotoViewData>('photo:view', async (data) => {
    console.log('[NUI] Photo view:', data.metadata.photoId);
    
    const { viewerActions } = await import('~/stores/viewerStore');
    
    // Open image viewer
    viewerActions.open([data.url], data.metadata.description || 'Photo');
  });
  
  // Photo captured
  onNuiMessage<PhotoCapturedData>('photo:captured', async (data) => {
    console.log('[NUI] Photo captured:', data.photo.photoId);
    
    const { photoActions } = await import('~/stores/photoStore');
    const { notificationActions } = await import('~/stores/notificationStore');
    
    // Add photo to store
    photoActions.addPhoto(data.photo);
    
    // Notification
    notificationActions.notifySystem(
      'Photo Captured',
      `Photo ${data.photo.photoId} saved`,
      'success'
    );
  });
  
  // Photo released to press
  onNuiMessage<PhotoReleasedToPressData>('photo:releasedToPress', async (data) => {
    console.log('[NUI] Photo released to press:', data.photoId);
    
    const { photoActions } = await import('~/stores/photoStore');
    const { notificationActions } = await import('~/stores/notificationStore');
    
    // Update photo status
    photoActions.updatePhoto(data.photoId, {
      releasedToPress: true,
      releasedBy: data.releasedBy,
      releasedAt: data.releasedAt,
      releaseRestrictions: data.restrictions,
    });
    
    notificationActions.notifySystem(
      'Photo Released',
      `Photo ${data.photoId} released to press`,
      'info'
    );
  });
  
  console.log('[NUI Handlers] Photo handlers registered');
}
