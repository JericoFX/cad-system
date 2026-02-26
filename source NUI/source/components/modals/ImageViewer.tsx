import { Show, For } from 'solid-js';
import { terminalActions } from '~/stores/terminalStore';
import { viewerState, viewerActions } from '~/stores/viewerStore';
import { Button, Modal } from '~/components/ui';

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
        <Modal.Root onClose={handleClose} useContentWrapper={false}>
      <div class="modal-content image-viewer" onClick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h2>{props.title || 'IMAGE VIEWER'} [{currentIndex() + 1}/{totalImages()}]</h2>
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
            gap: '12px',
            padding: '10px',
            'border-top': '2px solid var(--terminal-border)',
            'background-color': 'var(--terminal-bg)'
          }}>
            <Button.Root 
              class="btn"
              onClick={() => viewerActions.prevImage()}
              disabled={currentIndex() === 0}
            >
              [&lt;&lt;]
            </Button.Root>
            
            <div class="image-thumbnails" style={{
              display: 'flex',
              gap: '6px',
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
                      width: '50px',
                      height: '38px',
                      'object-fit': 'cover',
                      cursor: 'pointer',
                      border: index() === currentIndex() 
                        ? '2px solid var(--terminal-system)' 
                        : '2px solid var(--terminal-border)',
                      opacity: index() === currentIndex() ? '1' : '0.5'
                    }}
                  />
                )}
              </For>
            </div>
            
            <Button.Root 
              class="btn"
              onClick={() => viewerActions.nextImage()}
              disabled={currentIndex() === totalImages() - 1}
            >
              [&gt;&gt;]
            </Button.Root>
          </div>
        </Show>

        <div class="modal-footer">
          <span class="footer-text">Image evidence</span>
          <Button.Root class="btn" onClick={handleClose}>[CLOSE]</Button.Root>
        </div>
      </div>
    </Modal.Root>
  );
}
