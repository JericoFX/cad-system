import { createSignal, createMemo, For, Show, onMount } from 'solid-js';
import { terminalActions } from '~/stores/terminalStore';
import { photoActions, photoState, type PhotoMetadata } from '~/stores/photoStore';
import { Button, Input, Modal } from '~/components/ui';

interface ReleasedEvidenceFeedProps {
  onPhotoSelect?: (photo: PhotoMetadata) => void;
  onClose?: () => void;
}

export function ReleasedEvidenceFeed(props: ReleasedEvidenceFeedProps) {
  const [isLoading, setIsLoading] = createSignal(true);
  const [selectedPhoto, setSelectedPhoto] = createSignal<PhotoMetadata | null>(null);
  const [searchQuery, setSearchQuery] = createSignal('');

  onMount(async () => {
    await photoActions.fetchReleasedPhotos();
    setIsLoading(false);
  });

  const filteredPhotos = createMemo(() => {
    const query = searchQuery().toLowerCase();
    return photoState.releasedPhotos.filter(photo => {
      if (query) {
        return (
          photo.photoId.toLowerCase().includes(query) ||
          photo.description?.toLowerCase().includes(query) ||
          photo.takenBy?.toLowerCase().includes(query) ||
          photo.releaseReason?.toLowerCase().includes(query)
        );
      }
      return true;
    });
  });

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString();
  };

  const formatDateTime = (isoString: string) => {
    return new Date(isoString).toLocaleString();
  };

  const formatCoords = (coords: { x: number; y: number; z: number }) => {
    return `${coords.x.toFixed(2)}, ${coords.y.toFixed(2)}`;
  };

  const getDaysRemaining = (expiryDate?: string) => {
    if (!expiryDate) return null;
    const expiry = new Date(expiryDate).getTime();
    const now = Date.now();
    const days = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  };

  return (
    <div class="released-evidence-feed" style={{ padding: '16px' }}>
      <div style={{
        'margin-bottom': '20px',
        padding: '15px',
        'background-color': 'rgba(255, 255, 0, 0.1)',
        border: '1px solid #ffff00',
      }}>
        <h3 style={{ 
          color: '#ffff00', 
          'margin-bottom': '8px',
          display: 'flex',
          'align-items': 'center',
          gap: '10px'
        }}>
          <span>📰</span>
          POLICE EVIDENCE RELEASED TO PRESS
        </h3>
        <p style={{ 
          'font-size': '13px', 
          color: '#c0c0c0',
          margin: 0 
        }}>
          The following evidence photos have been authorized for publication by police supervisors.
          These images are released "as-is" and cannot be edited.
        </p>
      </div>

      <div style={{ 'margin-bottom': '15px' }}>
        <Input.Root
          type="text"
          class="dos-input"
          value={searchQuery()}
          onInput={e => setSearchQuery(e.currentTarget.value)}
          placeholder="Search by ID, description, photographer, or reason..."
          style={{ width: '100%' }}
        />
      </div>

      <Show when={isLoading()}>
        <div style={{ 
          display: 'flex', 
          'align-items': 'center', 
          'justify-content': 'center',
          padding: '40px',
          color: '#c0c0c0'
        }}>
          Loading released evidence...
        </div>
      </Show>

      <Show when={!isLoading() && filteredPhotos().length === 0}>
        <div style={{ 
          padding: '40px',
          'text-align': 'center',
          color: '#808080'
        }}>
          <div style={{ 'font-size': '24px', 'margin-bottom': '10px' }}>📷</div>
          <div>No evidence photos have been released to press yet</div>
          <div style={{ 
            'font-size': '12px', 
            'margin-top': '10px',
            color: '#606060'
          }}>
            Check back later or contact the police department
          </div>
        </div>
      </Show>

      <Show when={!isLoading() && filteredPhotos().length > 0}>
        <div style={{ 
          display: 'grid',
          'grid-template-columns': 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '15px'
        }}>
          <For each={filteredPhotos()}>
            {(photo) => {
              const daysRemaining = getDaysRemaining(photo.releaseRestrictions?.expiryDate);
              
              return (
                <div
                  class="evidence-card"
                  onClick={() => {
                    setSelectedPhoto(photo);
                    if (props.onPhotoSelect) {
                      props.onPhotoSelect(photo);
                    }
                  }}
                  style={{
                    border: '1px solid var(--terminal-border-dim)',
                    'background-color': 'rgba(0, 0, 0, 0.3)',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{
                    height: '160px',
                    'background-color': '#000',
                    overflow: 'hidden',
                    position: 'relative'
                  }}>
                    <img
                      src={photo.photoUrl}
                      alt={photo.photoId}
                      style={{
                        width: '100%',
                        height: '100%',
                        'object-fit': 'cover'
                      }}
                    />
                    
                    <Show when={daysRemaining !== null}>
                      <div style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        padding: '4px 8px',
                        'background-color': daysRemaining && daysRemaining < 7 ? '#ff0000' : '#ffff00',
                        color: daysRemaining && daysRemaining < 7 ? '#fff' : '#000',
                        'font-size': '11px',
                        'font-weight': 'bold',
                        'border-radius': '2px'
                      }}>
                        {daysRemaining}d remaining
                      </div>
                    </Show>
                    
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      'background-color': 'rgba(0,0,0,0.7)',
                      display: 'flex',
                      'align-items': 'center',
                      'justify-content': 'center',
                      opacity: 0,
                      transition: 'opacity 0.2s'
                    }}>
                      <span style={{ color: '#ffff00', 'font-size': '14px' }}>
                        [VIEW DETAILS]
                      </span>
                    </div>
                  </div>

                  <div style={{ padding: '12px' }}>
                    <div style={{ 
                      'font-size': '12px', 
                      color: '#ffff00',
                      'margin-bottom': '6px',
                      'font-weight': 'bold'
                    }}>
                      {photo.photoId}
                    </div>
                    
                    <div style={{ 
                      'font-size': '11px', 
                      color: '#c0c0c0',
                      'margin-bottom': '4px'
                    }}>
                      Released: {formatDate(photo.releasedAt || '')}
                    </div>
                    
                    <div style={{ 
                      'font-size': '11px', 
                      color: '#808080'
                    }}>
                      Photo by: {photo.takenBy}
                    </div>

                    <Show when={photo.description}>
                      <div style={{
                        'margin-top': '8px',
                        'font-size': '11px',
                        color: '#606060',
                        overflow: 'hidden',
                        'text-overflow': 'ellipsis',
                        'white-space': 'nowrap'
                      }}>
                        {photo.description}
                      </div>
                    </Show>
                  </div>
                </div>
              );
            }}
          </For>
        </div>
      </Show>

      <Show when={selectedPhoto()}>
                <Modal.Root onClose={() => setSelectedPhoto(null)} useContentWrapper={false}>
          <div
            class="modal-content"
            onClick={e => e.stopPropagation()}
            style={{ 
              'max-width': '900px', 
              width: '95%',
              'max-height': '90vh',
              overflow: 'auto'
            }}
          >
            <div class="modal-header" style={{ 'border-bottom': '2px solid #ffff00' }}>
              <h2 style={{ color: '#ffff00' }}>
                [EVIDENCE DETAILS]
              </h2>
              <button 
                class="modal-close" 
                onClick={() => setSelectedPhoto(null)}
              >
                [X]
              </button>
            </div>

            <div class="modal-body" style={{ padding: '20px' }}>
              <div style={{
                'margin-bottom': '20px',
                border: '1px solid #ffff00',
                'background-color': '#000',
                padding: '10px'
              }}>
                <img
                  src={selectedPhoto()!.photoUrl}
                  alt={selectedPhoto()!.photoId}
                  style={{
                    'max-width': '100%',
                    'max-height': '500px',
                    'object-fit': 'contain',
                    display: 'block',
                    margin: '0 auto'
                  }}
                />
              </div>

              <div style={{
                display: 'grid',
                'grid-template-columns': 'repeat(2, 1fr)',
                gap: '15px',
                'margin-bottom': '20px',
                'font-size': '13px'
              }}>
                <div style={{
                  padding: '12px',
                  'background-color': 'rgba(0,0,0,0.3)',
                  border: '1px solid var(--terminal-border-dim)'
                }}>
                  <div style={{ color: '#ffff00', 'margin-bottom': '5px' }}>
                    <strong>Photo ID</strong>
                  </div>
                  <div>{selectedPhoto()!.photoId}</div>
                </div>

                <div style={{
                  padding: '12px',
                  'background-color': 'rgba(0,0,0,0.3)',
                  border: '1px solid var(--terminal-border-dim)'
                }}>
                  <div style={{ color: '#ffff00', 'margin-bottom': '5px' }}>
                    <strong>Captured</strong>
                  </div>
                  <div>{formatDateTime(selectedPhoto()!.takenAt)}</div>
                </div>

                <div style={{
                  padding: '12px',
                  'background-color': 'rgba(0,0,0,0.3)',
                  border: '1px solid var(--terminal-border-dim)'
                }}>
                  <div style={{ color: '#ffff00', 'margin-bottom': '5px' }}>
                    <strong>Photographer</strong>
                  </div>
                  <div>{selectedPhoto()!.takenBy}</div>
                </div>

                <div style={{
                  padding: '12px',
                  'background-color': 'rgba(0,0,0,0.3)',
                  border: '1px solid var(--terminal-border-dim)'
                }}>
                  <div style={{ color: '#ffff00', 'margin-bottom': '5px' }}>
                    <strong>Location</strong>
                  </div>
                  <div>{formatCoords(selectedPhoto()!.location)}</div>
                </div>

                <div style={{
                  padding: '12px',
                  'background-color': 'rgba(0,0,0,0.3)',
                  border: '1px solid var(--terminal-border-dim)'
                }}>
                  <div style={{ color: '#ffff00', 'margin-bottom': '5px' }}>
                    <strong>Released</strong>
                  </div>
                  <div>{formatDateTime(selectedPhoto()!.releasedAt || '')}</div>
                </div>

                <div style={{
                  padding: '12px',
                  'background-color': 'rgba(0,0,0,0.3)',
                  border: '1px solid var(--terminal-border-dim)'
                }}>
                  <div style={{ color: '#ffff00', 'margin-bottom': '5px' }}>
                    <strong>Released By</strong>
                  </div>
                  <div>{selectedPhoto()!.releasedBy || 'Unknown'}</div>
                </div>
              </div>

              <Show when={selectedPhoto()!.releaseReason}>
                <div style={{
                  padding: '15px',
                  'background-color': 'rgba(255, 255, 0, 0.05)',
                  border: '1px solid #ffff00',
                  'margin-bottom': '20px'
                }}>
                  <div style={{ color: '#ffff00', 'margin-bottom': '8px' }}>
                    <strong>Release Authorization:</strong>
                  </div>
                  <div style={{ 'font-size': '13px', color: '#c0c0c0' }}>
                    {selectedPhoto()!.releaseReason}
                  </div>
                </div>
              </Show>

              <Show when={selectedPhoto()!.description}>
                <div style={{
                  padding: '15px',
                  'background-color': 'rgba(0,0,0,0.3)',
                  border: '1px solid var(--terminal-border-dim)',
                  'margin-bottom': '20px'
                }}>
                  <div style={{ color: '#00ffff', 'margin-bottom': '8px' }}>
                    <strong>Original Description:</strong>
                  </div>
                  <div style={{ 'font-size': '13px', color: '#c0c0c0' }}>
                    {selectedPhoto()!.description}
                  </div>
                </div>
              </Show>

              <div style={{
                padding: '12px',
                'background-color': 'rgba(255, 0, 0, 0.05)',
                border: '1px solid #ff0000',
                'margin-bottom': '20px',
                'font-size': '12px'
              }}>
                <strong style={{ color: '#ff0000' }}>⚠️ PUBLICATION NOTICE</strong>
                <p style={{ margin: '8px 0 0 0', color: '#c0c0c0' }}>
                  This image is released for press publication "as-is". 
                  <strong>No editing, cropping, or filters permitted.</strong>
                  {' '}
                  {selectedPhoto()!.releaseRestrictions?.expiryDate && 
                    `Must be published before ${formatDate(selectedPhoto()!.releaseRestrictions!.expiryDate!)}.`}
                </p>
              </div>

              <div class="modal-footer" style={{ 
                display: 'flex', 
                'justify-content': 'space-between',
                'align-items': 'center'
              }}>
                <Button.Root 
                  class="btn" 
                  onClick={() => setSelectedPhoto(null)}
                >
                  [CLOSE]
                </Button.Root>
                
                <Button.Root 
                  class="btn btn-primary"
                  onClick={() => {
                    terminalActions.addLine(
                      `Photo ${selectedPhoto()!.photoId} ready for article`,
                      'output'
                    );
                    setSelectedPhoto(null);
                  }}
                  style={{ 
                    'background-color': '#00ffff',
                    color: '#000'
                  }}
                >
                  [USE IN ARTICLE]
                </Button.Root>
              </div>
            </div>
          </div>
        </Modal.Root>
      </Show>
    </div>
  );
}
