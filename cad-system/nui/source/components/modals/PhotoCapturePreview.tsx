import { createSignal, Show, onMount } from 'solid-js';
import { terminalActions } from '~/stores/terminalStore';
import { photoActions, photoState, type PhotoMetadata } from '~/stores/photoStore';

interface PhotoCapturePreviewProps {
  photoData: {
    photoId: string;
    photoUrl: string;
    job: 'police' | 'reporter';
    location: { x: number; y: number; z: number };
    fov: {
      hit: boolean;
      hitCoords?: { x: number; y: number; z: number };
      distance: number;
      entityType?: string;
    };
  };
  onClose: () => void;
  onConfirm?: (description: string) => void;
}

export function PhotoCapturePreview(props: PhotoCapturePreviewProps) {
  const [description, setDescription] = createSignal('');
  const [isLoading, setIsLoading] = createSignal(false);
  const [imageError, setImageError] = createSignal(false);

  onMount(() => {
    // Load current photo into state
    if (props.photoData) {
      const photo: PhotoMetadata = {
        photoId: props.photoData.photoId,
        photoUrl: props.photoData.photoUrl,
        job: props.photoData.job,
        takenBy: '',
        takenByCitizenId: '',
        takenAt: new Date().toISOString(),
        location: props.photoData.location,
        description: '',
        fov: props.photoData.fov,
        isEvidence: props.photoData.job === 'police',
      };
      photoActions.setCurrentPhoto(photo);
    }
  });

  const handleConfirm = async () => {
    setIsLoading(true);
    
    try {
      if (props.onConfirm) {
        props.onConfirm(description());
      }
      
      // Add description to photo if provided
      if (description().trim()) {
        // Note: This would require a server callback to update description
        terminalActions.addLine(`Photo ${props.photoData.photoId} saved with description`, 'output');
      } else {
        terminalActions.addLine(`Photo ${props.photoData.photoId} saved`, 'output');
      }
      
      props.onClose();
    } catch (error) {
      terminalActions.addLine(`Failed to save photo: ${error}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    // Request deletion of photo
    terminalActions.addLine(`Photo ${props.photoData.photoId} discarded`, 'system');
    props.onClose();
  };

  const formatCoords = (coords: { x: number; y: number; z: number }) => {
    return `${coords.x.toFixed(2)}, ${coords.y.toFixed(2)}, ${coords.z.toFixed(2)}`;
  };

  const getFOVLabel = () => {
    const fov = props.photoData.fov;
    if (!fov.hit) return 'No target detected';
    
    const entityLabels: Record<string, string> = {
      ped: 'Person',
      vehicle: 'Vehicle',
      object: 'Object',
      unknown: 'Unknown'
    };
    
    return `${entityLabels[fov.entityType || 'unknown'] || 'Unknown'} at ${fov.distance.toFixed(1)}m`;
  };

  const getJobTitle = () => {
    return props.photoData.job === 'police' ? 'Evidence Photo' : 'Press Photo';
  };

  const getJobColor = () => {
    return props.photoData.job === 'police' ? '#00ff00' : '#00ffff';
  };

  return (
    <div class="modal-overlay" onClick={props.onClose}>
      <div 
        class="modal-content photo-preview-modal" 
        onClick={e => e.stopPropagation()}
        style={{ 'max-width': '800px', width: '90%' }}
      >
        <div class="modal-header" style={{ 'border-bottom': `2px solid ${getJobColor()}` }}>
          <h2 style={{ color: getJobColor() }}>
            [{getJobTitle().toUpperCase()}]
          </h2>
          <button class="modal-close" onClick={props.onClose}>[X]</button>
        </div>

        <div class="modal-body" style={{ padding: '20px' }}>
          {/* Photo Display */}
          <div 
            class="photo-preview-container" 
            style={{ 
              'margin-bottom': '20px',
              'border': `2px solid ${getJobColor()}`,
              'background-color': '#000',
              'min-height': '300px',
              'display': 'flex',
              'align-items': 'center',
              'justify-content': 'center'
            }}
          >
            <Show when={!imageError()} fallback={
              <div style={{ color: '#ff0000', padding: '20px' }}>
                [Failed to load image]
              </div>
            }>
              <img
                src={props.photoData.photoUrl}
                alt="Captured photo"
                style={{
                  'max-width': '100%',
                  'max-height': '500px',
                  'object-fit': 'contain'
                }}
                onError={() => setImageError(true)}
              />
            </Show>
          </div>

          {/* Photo Info */}
          <div 
            class="photo-info-panel" 
            style={{ 
              'background-color': 'rgba(0,0,0,0.3)',
              'border': '1px solid var(--terminal-border-dim)',
              'padding': '15px',
              'margin-bottom': '20px',
              'font-family': 'var(--font-terminal)',
              'font-size': '14px'
            }}
          >
            <div style={{ 'margin-bottom': '8px' }}>
              <strong style={{ color: getJobColor() }}>Photo ID:</strong> {props.photoData.photoId}
            </div>
            
            <div style={{ 'margin-bottom': '8px' }}>
              <strong style={{ color: getJobColor() }}>Location:</strong>{' '}
              {formatCoords(props.photoData.location)}
            </div>

            <Show when={props.photoData.job === 'police'}>
              <div style={{ 'margin-bottom': '8px' }}>
                <strong style={{ color: getJobColor() }}>FOV Target:</strong>{' '}
                {getFOVLabel()}
              </div>
              
              <Show when={props.photoData.fov.hit}>
                <div style={{ 'margin-bottom': '8px' }}>
                  <strong style={{ color: getJobColor() }}>Target Coords:</strong>{' '}
                  {formatCoords(props.photoData.fov.hitCoords || props.photoData.location)}
                </div>
              </Show>
            </Show>

            <div>
              <strong style={{ color: getJobColor() }}>Status:</strong>{' '}
              <span style={{ color: '#00ff00' }}>
                {props.photoData.job === 'police' ? 'In Staging' : 'Saved to Inventory'}
              </span>
            </div>
          </div>

          {/* Description Input */}
          <div class="form-group" style={{ 'margin-bottom': '20px' }}>
            <label style={{ 
              display: 'block', 
              'margin-bottom': '8px',
              color: getJobColor()
            }}>
              Description/Caption (Optional):
            </label>
            <textarea
              class="dos-textarea"
              value={description()}
              onInput={e => setDescription(e.currentTarget.value)}
              placeholder={props.photoData.job === 'police' 
                ? "Add evidence notes, context, observations..."
                : "Add caption for the article..."}
              rows={3}
              style={{ 
                width: '100%',
                'font-family': 'var(--font-terminal)'
              }}
            />
          </div>

          {/* Actions */}
          <div class="modal-footer" style={{ 
            display: 'flex', 
            'justify-content': 'flex-end',
            gap: '10px'
          }}>
            <button 
              class="btn" 
              onClick={handleCancel}
              disabled={isLoading()}
            >
              [DISCARD]
            </button>
            
            <button 
              class="btn btn-primary"
              onClick={handleConfirm}
              disabled={isLoading()}
              style={{ 
                'background-color': getJobColor(),
                color: '#000'
              }}
            >
              {isLoading() ? '[SAVING...]' : '[CONFIRM SAVE]'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
