import { createSignal, createMemo, For, Show, onMount } from 'solid-js';
import { terminalActions } from '~/stores/terminalStore';
import { photoActions, photoState, type PhotoMetadata } from '~/stores/photoStore';
import { fetchNui } from '~/utils/fetchNui';
import { Button, Input, Modal, Tabs } from '~/components/ui';

interface NewsPhotoImporterProps {
  onPhotosSelected: (photos: PhotoMetadata[]) => void;
  onCancel: () => void;
  maxPhotos?: number;
}

export function NewsPhotoImporter(props: NewsPhotoImporterProps) {
  const [activeTab, setActiveTab] = createSignal<'inventory' | 'released' | 'locker'>('inventory');
  const [selectedPhotos, setSelectedPhotos] = createSignal<Set<string>>(new Set());
  const [isLoading, setIsLoading] = createSignal(true);
  const [searchQuery, setSearchQuery] = createSignal('');
  const [lockerPhotos, setLockerPhotos] = createSignal<PhotoMetadata[]>([]);
  const [previewPhoto, setPreviewPhoto] = createSignal<PhotoMetadata | null>(null);

  const isImageUrl = (raw: string) => {
    const value = raw.trim();
    if (!value) {
      return false;
    }

    const clean = value.split('?')[0].split('#')[0].toLowerCase();
    return ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'].some(ext => clean.endsWith(ext));
  };

  const isImageEvidenceType = (evidenceType?: string) => {
    const normalized = String(evidenceType || '').toUpperCase();
    return normalized === 'PHOTO' || normalized === 'IMAGE';
  };

  const toLockerPhoto = (
    slot: {
      slot: number;
      metadata?: {
        data?: {
          url?: string;
          imageUrl?: string;
          photoUrl?: string;
          images?: string[];
          description?: string;
          takenBy?: string;
          takenAt?: string;
          location?: { x: number; y: number; z: number };
        };
        evidenceType?: string;
        createdAt?: string;
      };
    }
  ): PhotoMetadata[] => {
    const data = slot.metadata?.data || {};
    const evidenceType = slot.metadata?.evidenceType;
    const urls = [
      data.photoUrl,
      data.imageUrl,
      data.url,
      ...(Array.isArray(data.images) ? data.images : []),
    ].filter((url): url is string => typeof url === 'string' && url.trim().length > 0);

    const uniqueUrls = Array.from(new Set(urls));
    if (uniqueUrls.length === 0) {
      return [];
    }

    const filteredUrls = uniqueUrls.filter(url => isImageUrl(url) || isImageEvidenceType(evidenceType));
    if (filteredUrls.length === 0) {
      return [];
    }

    return filteredUrls.map((url, index) => ({
      photoId: `LOCKER_SLOT_${slot.slot}_${index + 1}`,
      photoUrl: url,
      job: 'reporter',
      takenBy: data.takenBy || 'Evidence Locker',
      takenByCitizenId: 'LOCKER',
      takenAt: data.takenAt || slot.metadata?.createdAt || new Date().toISOString(),
      location: data.location || { x: 0, y: 0, z: 0 },
      description: data.description || `Locker slot ${slot.slot}`,
      fov: {
        hit: false,
        distance: 0,
      },
      releasedToPress: isImageEvidenceType(evidenceType),
    }));
  };

  onMount(async () => {
    await Promise.all([
      photoActions.fetchInventoryPhotos(),
      photoActions.fetchReleasedPhotos(),
      loadLockerPhotos(),
    ]);
    setIsLoading(false);
  });

  const loadLockerPhotos = async () => {
    try {
      const context = await fetchNui<{
        ok: boolean;
        terminalId?: string;
        hasContainer?: boolean;
      }>('cad:getComputerContext', {});

      if (!context?.ok || !context.terminalId || !context.hasContainer) {
        setLockerPhotos([]);
        return;
      }

      const locker = await fetchNui<{
        ok: boolean;
        slots?: Array<{
          slot: number;
          itemName?: string;
          label?: string;
          metadata?: {
            data?: {
              url?: string;
              imageUrl?: string;
              photoUrl?: string;
              images?: string[];
              description?: string;
              takenBy?: string;
              takenAt?: string;
              location?: { x: number; y: number; z: number };
            };
            evidenceType?: string;
            createdAt?: string;
          };
        }>;
      }>('cad:evidence:container:list', { terminalId: context.terminalId });

      if (!locker?.ok || !Array.isArray(locker.slots)) {
        setLockerPhotos([]);
        return;
      }

      const items: PhotoMetadata[] = locker.slots.flatMap((slot) => toLockerPhoto(slot));

      setLockerPhotos(items);
    } catch {
      setLockerPhotos([]);
      terminalActions.addLine('Unable to load locker photos in this terminal', 'system');
    }
  };

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

  const lockerSourcePhotos = createMemo(() => {
    const query = searchQuery().toLowerCase();
    return lockerPhotos().filter(photo => {
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
    const lookup: Record<string, PhotoMetadata> = {
      ...photoState.photos,
      ...Object.fromEntries(lockerPhotos().map((photo) => [photo.photoId, photo])),
    };
    const photos: PhotoMetadata[] = [];
    
    selectedPhotos().forEach(photoId => {
      const photo = lookup[photoId];
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

          <div style={{ 'margin-top': '8px' }}>
            <Button.Root
              class="btn btn-small"
              onClick={(event: MouseEvent) => {
                event.stopPropagation();
                setPreviewPhoto(photo);
              }}
            >
              [VIEW]
            </Button.Root>
          </div>
        </div>
      </div>
    );
  };

  return (
        <Modal.Root onClose={props.onCancel} useContentWrapper={false}>
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
          <div style={{ 'margin-bottom': '15px' }}>
            <Input.Root
              type="text"
              class="dos-input"
              value={searchQuery()}
              onInput={e => setSearchQuery(e.currentTarget.value)}
              placeholder="Search photos by ID, description, or photographer..."
              style={{ width: '100%' }}
            />
          </div>

          <Tabs.Root
            value={activeTab()}
            onValueChange={(value) => setActiveTab(value as 'inventory' | 'released' | 'locker')}
            bracketed={false}
            uppercase={false}
          >
            <Tabs.List style={{ 'margin-bottom': '15px' }}>
              <Tabs.Trigger value='inventory' label='My Photos' badge={inventoryPhotos().length} />
              <Tabs.Trigger value='released' label='Released Evidence' badge={releasedPhotos().length} />
              <Tabs.Trigger value='locker' label='Locker Import' badge={lockerSourcePhotos().length} />
            </Tabs.List>
          </Tabs.Root>

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

            <Show when={!isLoading() && activeTab() === 'locker'}>
              <Show when={lockerSourcePhotos().length === 0}>
                <div class="empty-state" style={{
                  display: 'flex',
                  'align-items': 'center',
                  'justify-content': 'center',
                  height: '100%'
                }}>
                  No image evidence found in locker
                </div>
              </Show>
              <For each={lockerSourcePhotos()}>
                {photo => <PhotoCard {...photo} />}
              </For>
            </Show>
          </div>

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
            <Button.Root
              class="btn btn-small"
              onClick={() => setSelectedPhotos(new Set())}
              disabled={selectedPhotos().size === 0}
            >
              Clear Selection
            </Button.Root>
          </div>

          <div class="modal-footer" style={{
            'margin-top': '20px',
            display: 'flex', 
            'justify-content': 'space-between',
            'align-items': 'center'
          }}>
            <Button.Root 
              class="btn" 
              onClick={props.onCancel}
            >
              [CANCEL]
            </Button.Root>
            
            <Button.Root 
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
            </Button.Root>
          </div>
        </div>
      </div>

      <Show when={previewPhoto()}>
        <Modal.Root onClose={() => setPreviewPhoto(null)} useContentWrapper={false}>
          <div
            class="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ 'max-width': '900px', width: '90%' }}
          >
            <div class="modal-header">
              <h2>[PHOTO PREVIEW]</h2>
              <button class="modal-close" onClick={() => setPreviewPhoto(null)}>[X]</button>
            </div>
            <div class="modal-body" style={{ padding: '16px' }}>
              <Show when={previewPhoto()}>
                <img
                  src={previewPhoto()!.photoUrl}
                  alt={previewPhoto()!.photoId}
                  style={{ width: '100%', 'max-height': '62vh', 'object-fit': 'contain', border: '1px solid var(--terminal-border-dim)' }}
                />
                <div style={{ 'margin-top': '10px', color: '#c0c0c0' }}>
                  {previewPhoto()!.description || previewPhoto()!.photoId}
                </div>
              </Show>
            </div>
            <div class="modal-footer" style={{ display: 'flex', 'justify-content': 'space-between' }}>
              <Button.Root class="btn" onClick={() => setPreviewPhoto(null)}>[CLOSE]</Button.Root>
              <Button.Root
                class="btn btn-primary"
                onClick={() => {
                  const photo = previewPhoto();
                  if (photo) {
                    togglePhotoSelection(photo.photoId);
                  }
                  setPreviewPhoto(null);
                }}
              >
                [TOGGLE SELECT]
              </Button.Root>
            </div>
          </div>
        </Modal.Root>
      </Show>
    </Modal.Root>
  );
}
