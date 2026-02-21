import { JSX, mergeProps, splitProps, For, Show } from 'solid-js';
import { cn } from '~/utils/cn';
import { useUIContext } from './UIContext';
import { viewerActions } from '~/stores/viewerStore';

export interface PhotoGalleryProps {
  photos: string[];
  onPhotoClick?: (index: number) => void;
  maxPhotos?: number;
  class?: string;
  style?: JSX.CSSProperties;
}

function PhotoGallery(props: PhotoGalleryProps) {
  const ui = useUIContext();
  const merged = mergeProps(
    {
      maxPhotos: 3,
    },
    props
  );

  const [local, galleryProps] = splitProps(merged, [
    'photos',
    'onPhotoClick',
    'maxPhotos',
    'class',
    'style',
  ]);

  const displayedPhotos = () => local.photos.slice(0, local.maxPhotos);
  const remainingCount = () => Math.max(0, local.photos.length - local.maxPhotos);

  const handlePhotoClick = (index: number) => {
    if (local.onPhotoClick) {
      local.onPhotoClick(index);
    } else {
      // Default behavior: open in image viewer
      viewerActions.openImages(local.photos, 'Photo Gallery');
    }
  };

  return (
    <div
      {...galleryProps}
      class={cn('photo-gallery', local.class)}
      style={local.style}
    >
      <div 
        class="photo-grid" 
        style={{ 
          display: 'grid',
          'grid-template-columns': `repeat(${Math.min(displayedPhotos().length, local.maxPhotos)}, 1fr)`,
          gap: '8px',
          'max-width': '260px'
        }}
      >
        <For each={displayedPhotos()}>
          {(photo, index) => (
            <div 
              class="photo-thumbnail-container"
              style={{
                position: 'relative',
                cursor: 'pointer',
                border: '1px solid var(--terminal-border)',
                'background-color': 'rgba(0, 0, 0, 0.3)',
                width: '80px',
                height: '60px',
                overflow: 'hidden'
              }}
              onClick={() => handlePhotoClick(index())}
            >
              <img
                src={photo}
                alt={`Photo ${index() + 1}`}
                style={{
                  width: '100%',
                  height: '100%',
                  'object-fit': 'cover'
                }}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const errorDiv = document.createElement('div');
                  errorDiv.className = 'photo-error';
                  errorDiv.textContent = '[X]';
                  errorDiv.style.display = 'flex';
                  errorDiv.style.alignItems = 'center';
                  errorDiv.style.justifyContent = 'center';
                  errorDiv.style.width = '100%';
                  errorDiv.style.height = '100%';
                  errorDiv.style.color = 'var(--terminal-error)';
                  errorDiv.style.fontWeight = 'bold';
                  target.parentNode?.appendChild(errorDiv);
                }}
              />
            </div>
          )}
        </For>
        
        <Show when={remainingCount() > 0}>
          <div 
            class="photo-more-indicator"
            style={{
              display: 'flex',
              'align-items': 'center',
              'justify-content': 'center',
              border: '1px solid var(--terminal-border)',
              'background-color': 'rgba(0, 0, 0, 0.3)',
              width: '80px',
              height: '60px',
              cursor: 'pointer',
              color: 'var(--terminal-system-bright)',
              'font-weight': 'bold',
              'font-size': '12px'
            }}
            onClick={() => handlePhotoClick(local.maxPhotos)}
          >
            +{remainingCount()}
          </div>
        </Show>
      </div>
      
      <Show when={local.photos.length === 0}>
        <div 
          class="photo-empty"
          style={{
            color: 'var(--terminal-fg-dim)',
            'font-size': '12px',
            'font-style': 'italic',
            padding: '8px 0'
          }}
        >
          No photos available
        </div>
      </Show>
    </div>
  );
}

export const PhotoGalleryComponent = Object.assign(PhotoGallery, {
  Root: PhotoGallery,
});

export type PhotoGalleryComponent = typeof PhotoGalleryComponent;

export { PhotoGallery };