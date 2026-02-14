import { createSignal, createMemo, For, Show, onMount } from 'solid-js';
import { terminalActions } from '~/stores/terminalStore';
import { photoActions, photoState, type PhotoMetadata } from '~/stores/photoStore';

interface NewsPhotoImporterProps {
  onPhotosSelected: (photos: PhotoMetadata[]) => void;
  onCancel: () => void;
  maxPhotos?: number;
}

export function NewsPhotoImporter(props: NewsPhotoImporterProps) {
  const [activeTab, setActiveTab] = createSignal<'inventory' | 'released'>('inventory');
  const [selectedPhotos, setSelectedPhotos] = createSignal<Set<string>>(new Set());
  const [isLoading, setIsLoading] = createSignal(true);
  const [searchQuery, setSearchQuery] = createSignal('');

  onMount(async () => {
    // Load both sources
    await Promise.all([
      photoActions.fetchInventoryPhotos(),
      photoActions.fetchReleasedPhotos()
    ]);
    setIsLoading(false);
  });

  const inventoryPhotos = createMemo(() => {
    const query = searchQuery().toLowerCase();
    return photoState.inventoryPhotos.filter(photo => {
      if (query) {
        return (
          photo.photoId.toLowerCase().includes(query) ||
          photo.description?.toLowerCase().includes(query) ||
          photo.takenBy?.toLowerCase().includes(query)
        );
      }
      return true;
    });
  });

  const releasedPhotos = createMemo(() => {
    const query = searchQuery().toLowerCase();
    return photoState.releasedPhotos.filter(photo => {
      if (query) {
        return (
          photo.photoId.toLowerCase().includes(query) ||
          photo.description?.toLowerCase().includes(query) ||
          photo.takenBy?.toLowerCase().includes(query)
        );
      }
      return true;
    });
  });

  const togglePhotoSelection = (photoId: string) => {
    setSelectedPhotos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(photoId)) {
        newSet.delete(photoId);
      } else {
        // Check max limit
        const max = props.maxPhotos || 10;
        if (newSet.size >= max) {
          terminalActions.addLine(`Maximum ${max} photos allowed`, 'error');
          return prev;
        }
        newSet.add(photoId);
      }
      return newSet;
    });
  };

  const handleImport = () => {
    const photos: PhotoMetadata[] = [];
    
    // Get selected photos from both sources
    selectedPhotos().forEach(photoId => {
      const photo = photoState.photos[photoId];
      if (photo) {
        photos.push(photo);
      }
    });
    
    if (photos.length === 0) {
      terminalActions.addLine('No photos selected', 'error');
      return;
    }
    
    props.onPhotosSelected(photos);
    props.onCancel();
  };

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString();
  };

  const PhotoCard = (photo: PhotoMetadata) => {
    const isSelected = () => selectedPhotos().has(photo.photoId);
    const isReleased = () => photo.releasedToPress;

    return (
      <div
        class={`photo-card ${isSelected() ? 'selected' : ''}`}
        onClick={() => togglePhotoSelection(photo.photoId)}
        style={{
          border: `2px solid ${isSelected() ? '#00ffff' : isReleased() ? '#ffff00' : 'var(--terminal-border-dim)'}`,
          'background-color': isSelected() ? 'rgba(0, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.3)',
          padding: '10px',
          cursor: 'pointer',
          'margin-bottom': '10px',
          display: 'flex',
          gap: '15px',
          transition: 'all 0.2s'
        }}
      >
        {/* Thumbnail */}
        <div style={{
          width: '120px',
          height: '90px',
          'background-color': '#000',
          border: '1px solid var(--terminal-border-dim)',
          'flex-shrink': 0,
          display: 'flex',
          'align-items': 'center',
          'justify-content': 'center',
          overflow: 'hidden'
        }}>
          <img
            src={photo.photoUrl}
            alt={photo.photoId}
            style={{
              'max-width': '100%',
              'max-height': '100%',
              'object-fit': 'contain'
            }}
          />
        </div>

        {/* Info */}
        <div style={{ flex: 1, 'font-size': '13px' }}>
          <div style={{ 
            'margin-bottom': '5px',
            display: 'flex',
            'align-items': 'center',
            gap: '8px'
          }}>
            <strong style={{ color: isReleased() ? '#ffff00' : '#00ffff' }}>
              {photo.photoId}
            </strong>
            <Show when={isReleased()}>
              <span style={{
                'font-size': '10px',
                padding: '2px 6px',
                'background-color': '#ffff00',
                color: '#000',
                'border-radius': '2px'
              }}>
                RELEASED
              </span>
            </Show>
          </div>
          
          <div style={{ 'margin-bottom': '5px', color: '#c0c0c0' }}>
            <strong>Date:</strong> {formatDate(photo.takenAt)}
          </div>
          
          <div style={{ 'margin-bottom': '5px', color: '#c0c0c0' }}>
            <strong>By:</strong> {photo.takenBy}
          </div>

          <Show when={photo.description}>
            <div style={{
              color: '#808080',
              'font-size': '12px',
              'margin-top': '5px',
              overflow: 'hidden',
              'text-overflow': 'ellipsis',
              'white-space': 'nowrap'
            }}>
              {photo.description}
            </div>
          </Show>

          <Show when={isSelected()}>
            <div style={{
              'margin-top': '8px',
              color: '#00ffff',
              'font-size': '12px'
            }}>
              ✓ SELECTED
            </div>
          </Show>
        </div>
      </div>
    );
  };

  return (
    <div class="modal-overlay" onClick={props.onCancel}>
      <div 
        class="modal-content news-photo-importer" 
        onClick={e => e.stopPropagation()}
        style={{ 'max-width': '800px', width: '90%', 'max-height': '80vh' }}
      >
        <div class="modal-header" style={{ 'border-bottom': '2px solid #00ffff' }}>
          <h2 style={{ color: '#00ffff' }}>
            [IMPORT PHOTOS]
          </h2>
          <button class="modal-close" onClick={props.onCancel}>[X]</button>
        </div>

        <div class="modal-body" style={{ padding: '20px', display: 'flex', 'flex-direction': 'column' }}>
          {/* Search */}
          <div style={{ 'margin-bottom': '15px' }}>
            <input
              type="text"
              class="dos-input"
              value={searchQuery()}
              onInput={e => setSearchQuery(e.currentTarget.value)}
              placeholder="Search photos by ID, description, or photographer..."
              style={{ width: '100%' }}
            />
          </div>

          {/* Tabs */}
          <div class="detail-tabs" style={{ 'margin-bottom': '15px' }}>
            <button
              class={`tab ${activeTab() === 'inventory' ? 'active' : ''}`}
              onClick={() => setActiveTab('inventory')}
            >
              My Photos ({inventoryPhotos().length})
            </button>
            <button
              class={`tab ${activeTab() === 'released' ? 'active' : ''}`}
              onClick={() => setActiveTab('released')}
            >
              Released Evidence ({releasedPhotos().length})
            </button>
          </div>

          {/* Photo List */}
          <div style={{ 
            flex: 1,
            overflow: 'auto',
            'min-height': '300px',
            'max-height': '400px',
            border: '1px solid var(--terminal-border-dim)',
            padding: '10px',
            'background-color': 'rgba(0, 0, 0, 0.3)'
          }}>
            <Show when={isLoading()}>
              <div style={{ 
                display: 'flex', 
                'align-items': 'center', 
                'justify-content': 'center',
                height: '100%',
                color: '#c0c0c0'
              }}>
                Loading photos...
              </div>
            </Show>

            <Show when={!isLoading() && activeTab() === 'inventory'}>
              <Show when={inventoryPhotos().length === 0}>
                <div class="empty-state" style={{ 
                  display: 'flex', 
                  'align-items': 'center', 
                  'justify-content': 'center',
                  height: '100%'
                }}>
                  No photos in your inventory
                </div>
              </Show>
              <For each={inventoryPhotos()}>
                {photo => <PhotoCard {...photo} />}
              </For>
            </Show>

            <Show when={!isLoading() && activeTab() === 'released'}>
              <Show when={releasedPhotos().length === 0}>
                <div class="empty-state" style={{ 
                  display: 'flex', 
                  'align-items': 'center', 
                  'justify-content': 'center',
                  height: '100%'
                }}>
                  No photos released by police
                </div>
              </Show>
              <div style={{
                'background-color': 'rgba(255, 255, 0, 0.05)',
                border: '1px solid #ffff00',
                padding: '10px',
                'margin-bottom': '15px',
                'font-size': '12px'
              }}>
                <strong style={{ color: '#ffff00' }}>⚠️ Released Evidence</strong>
                <p style={{ margin: '5px 0 0 0', color: '#c0c0c0' }}>
                  These photos were released by police supervisors for press publication.
                  They may have publication restrictions.
                </p>
              </div>
              <For each={releasedPhotos()}>
                {photo => <PhotoCard {...photo} />}
              </For>
            </Show>
          </div>

          {/* Selection Info */}
          <div style={{ 
            'margin-top': '15px',
            padding: '10px',
            'background-color': 'rgba(0, 255, 255, 0.1)',
            border: '1px solid #00ffff',
            display: 'flex',
            'justify-content': 'space-between',
            'align-items': 'center'
          }}>
            <span style={{ color: '#00ffff' }}>
              Selected: {selectedPhotos().size} / {props.maxPhotos || 10} max
            </span>
            <button
              class="btn btn-small"
              onClick={() => setSelectedPhotos(new Set())}
              disabled={selectedPhotos().size === 0}
            >
              Clear Selection
            </button>
          </div>

          {/* Actions */}
          <div class="modal-footer" style={{ 
            'margin-top': '20px',
            display: 'flex', 
            'justify-content': 'space-between',
            'align-items': 'center'
          }}>
            <button 
              class="btn" 
              onClick={props.onCancel}
            >
              [CANCEL]
            </button>
            
            <button 
              class="btn btn-primary"
              onClick={handleImport}
              disabled={selectedPhotos().size === 0}
              style={{ 
                'background-color': '#00ffff',
                color: '#000',
                opacity: selectedPhotos().size > 0 ? 1 : 0.5
              }}
            >
              [IMPORT {selectedPhotos().size} PHOTO{selectedPhotos().size === 1 ? '' : 'S'}]
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
