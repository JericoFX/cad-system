import { Show, For } from 'solid-js';
import { terminalActions } from '~/stores/terminalStore';
import { viewerState, viewerActions } from '~/stores/viewerStore';

interface ImageViewerProps {
  imageUrl?: string;
  images?: string[];
  title?: string;
  onClose?: () => void;
}

export function ImageViewer(props: ImageViewerProps) {
  const images = () => props.images || (props.imageUrl ? [props.imageUrl] : []);
  const currentIndex = () => viewerState.currentIndex;
  const currentImage = () => images()[currentIndex()] || images()[0];
  const totalImages = () => images().length;

  const handleClose = () => {
    if (props.onClose) {
      props.onClose();
    } else {
      terminalActions.setActiveModal(null);
      viewerActions.close();
    }
  };

  const goToImage = (index: number) => {
    if (index >= 0 && index < totalImages()) {
      viewerActions.goToImage(index);
    }
  };

  return (
    <div class="modal-overlay police-watermark" onClick={handleClose}>
      <div class="modal-content image-viewer" onClick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h2>=== IMAGE VIEWER {props.title ? `- ${props.title}` : ''} [{currentIndex() + 1}/{totalImages()}] ===</h2>
          <button class="modal-close" onClick={handleClose}>[X]</button>
        </div>

        <div class="image-viewer-content">
          <Show 
            when={totalImages() > 0} 
            fallback={<div class="image-error">No images provided</div>}
          >
            <img 
              src={currentImage()} 
              alt="Evidence" 
              class="viewer-image"
              style={{ 'user-select': 'none', '-webkit-user-drag': 'none' }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                const error = document.createElement('div');
                error.className = 'image-error';
                error.textContent = 'Failed to load image. URL may be invalid or inaccessible.';
                e.target.parentNode?.appendChild(error);
              }}
            />
          </Show>
        </div>

        <Show when={totalImages() > 1}>
          <div class="image-navigation" style={{
            display: 'flex',
            'align-items': 'center',
            'justify-content': 'center',
            gap: '16px',
            padding: '12px',
            'border-top': '1px solid var(--terminal-border)',
            'border-bottom': '1px solid var(--terminal-border)'
          }}>
            <button 
              class="btn"
              onClick={() => viewerActions.prevImage()}
              disabled={currentIndex() === 0}
            >
              [&lt; PREV]
            </button>
            
            <div class="image-thumbnails" style={{
              display: 'flex',
              gap: '8px',
              'max-width': '400px',
              'overflow-x': 'auto',
              padding: '4px'
            }}>
              <For each={images()}>
                {(img, index) => (
                  <img
                    src={img}
                    alt={`Thumbnail ${index() + 1}`}
                    onClick={() => goToImage(index())}
                    style={{
                      width: '60px',
                      height: '45px',
                      'object-fit': 'cover',
                      cursor: 'pointer',
                      border: index() === currentIndex() 
                        ? '2px solid var(--terminal-system)' 
                        : '2px solid var(--terminal-border)',
                      opacity: index() === currentIndex() ? '1' : '0.6'
                    }}
                  />
                )}
              </For>
            </div>
            
            <button 
              class="btn"
              onClick={() => viewerActions.nextImage()}
              disabled={currentIndex() === totalImages() - 1}
            >
              [NEXT &gt;]
            </button>
          </div>
        </Show>

        <div class="image-viewer-info">
          <div class="image-url">
            <strong>URL:</strong>
            <a href={currentImage()} target="_blank" rel="noopener noreferrer">
              {currentImage()}
            </a>
          </div>
        </div>

        <div class="modal-footer">
          <span style={{ color: '#808080' }}>
            Use arrows or thumbnails to navigate • Click outside to close
          </span>
          <button class="btn" onClick={handleClose}>[CLOSE]</button>
        </div>
      </div>
    </div>
  );
}
