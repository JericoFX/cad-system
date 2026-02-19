import { createSignal, Show, createMemo } from 'solid-js';
import { terminalActions } from '~/stores/terminalStore';
import { photoActions, type PhotoMetadata } from '~/stores/photoStore';
import { Button, Modal, Select, Textarea } from '~/components/ui';

interface PhotoReleaseModalProps {
  photo: PhotoMetadata;
  onClose: () => void;
  onReleased?: () => void;
}

export function PhotoReleaseModal(props: PhotoReleaseModalProps) {
  const [reason, setReason] = createSignal('');
  const [expiryDays, setExpiryDays] = createSignal('30');
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const isValid = createMemo(() => {
    return reason().trim().length > 10;
  });

  const handleRelease = async () => {
    if (!isValid()) {
      setError('Please provide a detailed reason (min 10 characters)');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Calculate expiry date
      const days = parseInt(expiryDays());
      const expiryDate = days > 0 
        ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
        : undefined;

      const result = await photoActions.releaseToPress(
        props.photo.photoId,
        reason(),
        expiryDate
      );

      if (result.success) {
        terminalActions.addLine(
          `Photo ${props.photo.photoId} released to press`,
          'output'
        );
        
        if (props.onReleased) {
          props.onReleased();
        }
        
        props.onClose();
      } else {
        setError(result.error as string);
      }
    } catch (err) {
      setError(`Failed to release photo: ${err}`);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleString();
  };

  const formatCoords = (coords: { x: number; y: number; z: number }) => {
    return `${coords.x.toFixed(2)}, ${coords.y.toFixed(2)}, ${coords.z.toFixed(2)}`;
  };

  return (
        <Modal.Root onClose={props.onClose} useContentWrapper={false}>
      <div 
        class="modal-content photo-release-modal" 
        onClick={e => e.stopPropagation()}
        style={{ 'max-width': '700px', width: '90%' }}
      >
        <div class="modal-header" style={{ 'border-bottom': '2px solid #ffff00' }}>
          <h2 style={{ color: '#ffff00' }}>
            [RELEASE TO PRESS]
          </h2>
          <button class="modal-close" onClick={props.onClose}>[X]</button>
        </div>

        <div class="modal-body" style={{ padding: '20px' }}>
          {/* Warning Banner */}
          <div style={{
            'background-color': 'rgba(255, 255, 0, 0.1)',
            'border': '1px solid #ffff00',
            'padding': '12px',
            'margin-bottom': '20px',
            'font-size': '14px'
          }}>
            <strong style={{ color: '#ffff00' }}>⚠️ Authorization Required</strong>
            <p style={{ margin: '8px 0 0 0', 'font-size': '13px' }}>
              You are releasing evidence to the press. This action is logged and 
              requires supervisor authorization (Sargento+). The photo will be available 
              to all reporters and cannot be recalled once published.
            </p>
          </div>

          {/* Photo Preview */}
          <div style={{
            'margin-bottom': '20px',
            'border': '1px solid var(--terminal-border)',
            'background-color': '#000',
            'padding': '10px'
          }}>
            <div style={{ 'margin-bottom': '10px', color: '#00ff00' }}>
              <strong>Photo Preview:</strong>
            </div>
            <img
              src={props.photo.photoUrl}
              alt="Evidence"
              style={{
                'max-width': '100%',
                'max-height': '200px',
                'object-fit': 'contain',
                'display': 'block',
                'margin': '0 auto'
              }}
            />
          </div>

          {/* Photo Info */}
          <div style={{
            'background-color': 'rgba(0,0,0,0.3)',
            'border': '1px solid var(--terminal-border-dim)',
            'padding': '15px',
            'margin-bottom': '20px',
            'font-size': '13px'
          }}>
            <div style={{ 'margin-bottom': '8px' }}>
              <strong>Photo ID:</strong> {props.photo.photoId}
            </div>
            <div style={{ 'margin-bottom': '8px' }}>
              <strong>Captured:</strong> {formatDate(props.photo.takenAt)}
            </div>
            <div style={{ 'margin-bottom': '8px' }}>
              <strong>By:</strong> {props.photo.takenBy}
            </div>
            <div style={{ 'margin-bottom': '8px' }}>
              <strong>Location:</strong> {formatCoords(props.photo.location)}
            </div>
            <Show when={props.photo.description}>
              <div>
                <strong>Original Description:</strong>{' '}
                {props.photo.description}
              </div>
            </Show>
          </div>

          {/* Release Form */}
          <div class="form-group" style={{ 'margin-bottom': '20px' }}>
            <label style={{ 
              display: 'block', 
              'margin-bottom': '8px',
              color: '#ffff00'
            }}>
              Release Reason <span style={{ color: '#ff0000' }}>*</span>
            </label>
            <Textarea.Root
              class="dos-textarea"
              value={reason()}
              onInput={e => {
                setReason(e.currentTarget.value);
                setError(null);
              }}
              placeholder="Explain why this photo should be released to the press..."
              rows={4}
              style={{ width: '100%' }}
            />
            <div style={{ 
              'font-size': '12px', 
              'margin-top': '5px',
              color: reason().length < 10 ? '#ff0000' : '#00ff00'
            }}>
              {reason().length}/500 characters (min 10)
            </div>
          </div>

          {/* Expiry Setting */}
          <div class="form-group" style={{ 'margin-bottom': '20px' }}>
            <label style={{ 
              display: 'block', 
              'margin-bottom': '8px',
              color: '#ffff00'
            }}>
              Publication Duration:
            </label>
            <Select.Root
              class="dos-select"
              value={expiryDays()}
              onChange={e => setExpiryDays(e.currentTarget.value)}
              style={{ width: '100%' }}
            >
              <option value="7">7 Days</option>
              <option value="14">14 Days</option>
              <option value="30">30 Days</option>
              <option value="60">60 Days</option>
              <option value="0">No Expiry</option>
            </Select.Root>
            <div style={{ 
              'font-size': '12px', 
              'margin-top': '5px',
              color: '#c0c0c0'
            }}>
              Photo will be removed from press access after this period
            </div>
          </div>

          {/* Error Display */}
          <Show when={error()}>
            <div style={{
              'background-color': 'rgba(255, 0, 0, 0.1)',
              'border': '1px solid #ff0000',
              'padding': '12px',
              'margin-bottom': '20px',
              color: '#ff0000',
              'font-size': '14px'
            }}>
              <strong>Error:</strong> {error()}
            </div>
          </Show>

          {/* Actions */}
          <div class="modal-footer" style={{ 
            display: 'flex', 
            'justify-content': 'space-between',
            'align-items': 'center'
          }}>
            <Button.Root 
              class="btn" 
              onClick={props.onClose}
              disabled={isLoading()}
            >
              [CANCEL]
            </Button.Root>
            
            <Button.Root 
              class="btn btn-primary"
              onClick={handleRelease}
              disabled={isLoading() || !isValid()}
              style={{ 
                'background-color': '#ffff00',
                color: '#000',
                opacity: isValid() ? 1 : 0.5
              }}
            >
              {isLoading() ? '[PROCESSING...]' : '[RELEASE TO PRESS]'}
            </Button.Root>
          </div>
        </div>
      </div>
    </Modal.Root>
  );
}
