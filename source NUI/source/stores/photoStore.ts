import { createStore } from 'solid-js/store';
import { batch } from 'solid-js';
import { fetchNui } from '~/utils/fetchNui';

export interface PhotoFOV {
  hit: boolean;
  hitCoords?: { x: number; y: number; z: number };
  distance: number;
  entityType?: string;
}

export interface PhotoMetadata {
  photoId: string;
  photoUrl: string;
  job: 'police' | 'reporter';
  takenBy: string;
  takenByCitizenId: string;
  takenAt: string;
  location: { x: number; y: number; z: number };
  description: string;
  fov: PhotoFOV;
  
  // Police specific
  isEvidence?: boolean;
  stagingId?: string;
  attachedCaseId?: string;
  custodyChain?: CustodyEvent[];
  
  // News specific
  usedInArticles?: string[];
  
  // Release tracking
  releasedToPress?: boolean;
  releasedBy?: string;
  releasedAt?: string;
  releaseReason?: string;
  releaseRestrictions?: {
    editLevel: string;
    expiryDate?: string;
  };
}

export interface CustodyEvent {
  eventId: string;
  eventType: string;
  timestamp: string;
  recordedBy: string;
  notes?: string;
}

export interface PhotoSubmission {
  id: string;
  photoId: string;
  submittedBy: string;
  submittedByName: string;
  caseId?: string;
  reason: string;
  status: 'PENDING_REVIEW' | 'ACCEPTED' | 'REJECTED';
  submittedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
}

export interface PhotoState {
  photos: Record<string, PhotoMetadata>;
  stagingPhotos: PhotoMetadata[];
  inventoryPhotos: PhotoMetadata[];
  releasedPhotos: PhotoMetadata[];
  reviewQueue: PhotoSubmission[];
  currentPhoto: PhotoMetadata | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: PhotoState = {
  photos: {},
  stagingPhotos: [],
  inventoryPhotos: [],
  releasedPhotos: [],
  reviewQueue: [],
  currentPhoto: null,
  isLoading: false,
  error: null,
};

export const [photoState, setPhotoState] = createStore<PhotoState>(initialState);

function upsertPhotoMap(photo: PhotoMetadata) {
  setPhotoState('photos', prev => ({
    ...prev,
    [photo.photoId]: photo,
  }));
}

function prependUnique(list: PhotoMetadata[], photo: PhotoMetadata): PhotoMetadata[] {
  const next = list.filter(item => item.photoId !== photo.photoId);
  next.unshift(photo);
  return next;
}

function removeFromList(list: PhotoMetadata[], photoId: string): PhotoMetadata[] {
  return list.filter(item => item.photoId !== photoId);
}

export const photoActions = {
  // Set loading state
  setLoading(isLoading: boolean) {
    setPhotoState('isLoading', isLoading);
  },

  // Set error
  setError(error: string | null) {
    setPhotoState('error', error);
  },

  // Clear error
  clearError() {
    setPhotoState('error', null);
  },

  // Set current photo
  setCurrentPhoto(photo: PhotoMetadata | null) {
    setPhotoState('currentPhoto', photo);
  },

  addCapturedPhoto(photo: PhotoMetadata) {
    upsertPhotoMap(photo);

    if (photo.job === 'police') {
      setPhotoState('stagingPhotos', photos => prependUnique(photos, photo));
      return;
    }

    setPhotoState('inventoryPhotos', photos => prependUnique(photos, photo));
  },

  setPhotoDescription(photoId: string, description: string) {
    const existing = photoState.photos[photoId];
    if (!existing) {
      return;
    }

    const next = { ...existing, description };
    batch(() => {
      upsertPhotoMap(next);
      setPhotoState('stagingPhotos', photos =>
        photos.map(photo => (photo.photoId === photoId ? { ...photo, description } : photo))
      );
      setPhotoState('inventoryPhotos', photos =>
        photos.map(photo => (photo.photoId === photoId ? { ...photo, description } : photo))
      );
      setPhotoState('releasedPhotos', photos =>
        photos.map(photo => (photo.photoId === photoId ? { ...photo, description } : photo))
      );
    });
  },

  removePhoto(photoId: string) {
    batch(() => {
      setPhotoState('photos', prev => {
        const next = { ...prev };
        delete next[photoId];
        return next;
      });
      setPhotoState('stagingPhotos', photos => removeFromList(photos, photoId));
      setPhotoState('inventoryPhotos', photos => removeFromList(photos, photoId));
      setPhotoState('releasedPhotos', photos => removeFromList(photos, photoId));
      if (photoState.currentPhoto?.photoId === photoId) {
        setPhotoState('currentPhoto', null);
      }
    });
  },

  // Fetch staging photos (for police)
  async fetchStagingPhotos() {
    photoActions.setLoading(true);
    photoActions.clearError();
    
    try {
      const response = await fetchNui<{
        ok: boolean;
        photos?: PhotoMetadata[];
        error?: string;
      }>('cad:photos:getStagingPhotos', {});
      
      if (response?.ok && response.photos) {
        const photos = response.photos;
        batch(() => {
          setPhotoState('stagingPhotos', photos);
          
          // Update photos map
          const photosMap: Record<string, PhotoMetadata> = {};
          photos.forEach(photo => {
            photosMap[photo.photoId] = photo;
          });
          setPhotoState('photos', { ...photoState.photos, ...photosMap });
        });
      } else {
        photoActions.setError(response?.error || 'Failed to fetch staging photos');
      }
    } catch (error) {
      photoActions.setError(`Failed to fetch staging photos: ${error}`);
    } finally {
      photoActions.setLoading(false);
    }
  },

  // Fetch inventory photos (for news)
  async fetchInventoryPhotos() {
    photoActions.setLoading(true);
    photoActions.clearError();
    
    try {
      const response = await fetchNui<{
        ok: boolean;
        photos?: PhotoMetadata[];
        error?: string;
      }>('cad:photos:getInventoryPhotos', {});
      
      if (response?.ok && response.photos) {
        const photos = response.photos;
        batch(() => {
          setPhotoState('inventoryPhotos', photos);
          
          // Filter news photos only
          const newsPhotos = photos.filter(p => p.job === 'reporter');
          
          // Update photos map
          const photosMap: Record<string, PhotoMetadata> = {};
          newsPhotos.forEach(photo => {
            photosMap[photo.photoId] = photo;
          });
          setPhotoState('photos', { ...photoState.photos, ...photosMap });
        });
      } else {
        photoActions.setError(response?.error || 'Failed to fetch inventory photos');
      }
    } catch (error) {
      photoActions.setError(`Failed to fetch inventory photos: ${error}`);
    } finally {
      photoActions.setLoading(false);
    }
  },

  // Fetch released photos (for news)
  async fetchReleasedPhotos() {
    photoActions.setLoading(true);
    photoActions.clearError();
    
    try {
      const response = await fetchNui<{
        ok: boolean;
        photos?: PhotoMetadata[];
        error?: string;
      }>('cad:photos:getReleasedPhotos', {});
      
      if (response?.ok && response.photos) {
        const photos = response.photos;
        batch(() => {
          setPhotoState('releasedPhotos', photos);
          
          // Update photos map
          const photosMap: Record<string, PhotoMetadata> = {};
          photos.forEach(photo => {
            photosMap[photo.photoId] = photo;
          });
          setPhotoState('photos', { ...photoState.photos, ...photosMap });
        });
      } else {
        photoActions.setError(response?.error || 'Failed to fetch released photos');
      }
    } catch (error) {
      photoActions.setError(`Failed to fetch released photos: ${error}`);
    } finally {
      photoActions.setLoading(false);
    }
  },

  // Release photo to press (police only)
  async releaseToPress(photoId: string, reason: string, expiryDate?: string) {
    photoActions.setLoading(true);
    photoActions.clearError();
    
    try {
      const response = await fetchNui<{
        ok: boolean;
        photoId?: string;
        releasedAt?: string;
        error?: string;
      }>('cad:photos:releaseToPress', {
        photoId,
        reason,
        expiryDate
      });
      
      if (response?.ok) {
        // Update photo state
        setPhotoState('photos', photoId, 'releasedToPress', true);
        setPhotoState('photos', photoId, 'releasedAt', response.releasedAt);
        
        // Refresh released photos
        await photoActions.fetchReleasedPhotos();
        
        return { success: true, photoId: response.photoId };
      } else {
        photoActions.setError(response?.error || 'Failed to release photo');
        return { success: false, error: response?.error };
      }
    } catch (error) {
      photoActions.setError(`Failed to release photo: ${error}`);
      return { success: false, error };
    } finally {
      photoActions.setLoading(false);
    }
  },

  // Submit photo to police (news)
  async submitToPolice(photoId: string, caseId: string | undefined, reason: string) {
    photoActions.setLoading(true);
    photoActions.clearError();
    
    try {
      const response = await fetchNui<{
        ok: boolean;
        submissionId?: string;
        status?: string;
        error?: string;
      }>('cad:photos:submitToPolice', {
        photoId,
        caseId,
        reason
      });
      
      if (response?.ok) {
        return { success: true, submissionId: response.submissionId };
      } else {
        photoActions.setError(response?.error || 'Failed to submit photo');
        return { success: false, error: response?.error };
      }
    } catch (error) {
      photoActions.setError(`Failed to submit photo: ${error}`);
      return { success: false, error };
    } finally {
      photoActions.setLoading(false);
    }
  },

  // Fetch review queue (police)
  async fetchReviewQueue() {
    photoActions.setLoading(true);
    photoActions.clearError();
    
    try {
      const response = await fetchNui<{
        ok: boolean;
        queue?: PhotoSubmission[];
        error?: string;
      }>('cad:photos:getReviewQueue', {});
      
      if (response?.ok && response.queue) {
        setPhotoState('reviewQueue', response.queue);
      } else {
        photoActions.setError(response?.error || 'Failed to fetch review queue');
      }
    } catch (error) {
      photoActions.setError(`Failed to fetch review queue: ${error}`);
    } finally {
      photoActions.setLoading(false);
    }
  },

  // Review submission (police)
  async reviewSubmission(submissionId: string, action: 'ACCEPT' | 'REJECT', notes?: string) {
    photoActions.setLoading(true);
    photoActions.clearError();
    
    try {
      const response = await fetchNui<{
        ok: boolean;
        submissionId?: string;
        status?: string;
        error?: string;
      }>('cad:photos:reviewSubmission', {
        submissionId,
        action,
        notes
      });
      
      if (response?.ok) {
        // Remove from queue
        setPhotoState('reviewQueue', queue => 
          queue.filter(s => s.id !== submissionId)
        );
        
        // Refresh staging if accepted
        if (action === 'ACCEPT') {
          await photoActions.fetchStagingPhotos();
        }
        
        return { success: true };
      } else {
        photoActions.setError(response?.error || 'Failed to review submission');
        return { success: false, error: response?.error };
      }
    } catch (error) {
      photoActions.setError(`Failed to review submission: ${error}`);
      return { success: false, error };
    } finally {
      photoActions.setLoading(false);
    }
  },

  // Attach photo to case
  async attachToCase(photoId: string, caseId: string) {
    photoActions.setLoading(true);
    photoActions.clearError();
    
    try {
      const response = await fetchNui<{
        ok: boolean;
        photoId?: string;
        caseId?: string;
        error?: string;
      }>('cad:photos:attachToCase', {
        photoId,
        caseId
      });
      
      if (response?.ok) {
        // Update photo state
        setPhotoState('photos', photoId, 'attachedCaseId', caseId);
        
        // Remove from staging
        setPhotoState('stagingPhotos', photos => 
          photos.filter(p => p.photoId !== photoId)
        );
        
        return { success: true };
      } else {
        photoActions.setError(response?.error || 'Failed to attach photo');
        return { success: false, error: response?.error };
      }
    } catch (error) {
      photoActions.setError(`Failed to attach photo: ${error}`);
      return { success: false, error };
    } finally {
      photoActions.setLoading(false);
    }
  },

  // Get photo by ID
  getPhoto(photoId: string): PhotoMetadata | undefined {
    return photoState.photos[photoId];
  },

  // Get staging photos
  getStagingPhotos(): PhotoMetadata[] {
    return photoState.stagingPhotos;
  },

  // Get inventory photos
  getInventoryPhotos(): PhotoMetadata[] {
    return photoState.inventoryPhotos;
  },

  // Get released photos
  getReleasedPhotos(): PhotoMetadata[] {
    return photoState.releasedPhotos;
  },

  // Get review queue
  getReviewQueue(): PhotoSubmission[] {
    return photoState.reviewQueue;
  },

  // Clear all state
  reset() {
    setPhotoState({
      photos: {},
      stagingPhotos: [],
      inventoryPhotos: [],
      releasedPhotos: [],
      reviewQueue: [],
      currentPhoto: null,
      isLoading: false,
      error: null,
    });
  },
};
