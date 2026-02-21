import { createSignal, createMemo, Show, For, onMount } from 'solid-js';
import { terminalActions } from '~/stores/terminalStore';
import { cadActions, cadState } from '~/stores/cadStore';
import { photoActions, photoState, type PhotoMetadata } from '~/stores/photoStore';
import { viewerActions } from '~/stores/viewerStore';
import { fetchNui } from '~/utils/fetchNui';
import type { Evidence, Case, StagingEvidence, CustodyEvent } from '~/stores/cadStore';
import { userActions } from '~/stores/userStore';
import type { FileItem } from '../FileExplorer.types';
import { Button, Modal, Select } from '~/components/ui';

function isEvidence(value: unknown): value is Evidence {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Partial<Evidence>;
  return (
    typeof record.evidenceId === 'string' &&
    typeof record.caseId === 'string' &&
    typeof record.evidenceType === 'string' &&
    typeof record.attachedBy === 'string' &&
    typeof record.attachedAt === 'string' &&
    Array.isArray(record.custodyChain)
  );
}

type SelectedEvidence = Evidence | StagingEvidence;

type LockerSlot = {
  slot: number;
  label?: string;
  itemName?: string;
  metadata?: {
    evidenceType?: string;
    stagingId?: string;
    storedAt?: string;
  };
};

const FileExplorer = (await import('../FileExplorer')).FileExplorer;

const extractUrl = (data: unknown): string | null => {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (typeof d.url === 'string' && d.url.trim()) return d.url;
  if (typeof d.metadata === 'object' && d.metadata !== null) {
    const meta = d.metadata as Record<string, unknown>;
    if (typeof meta.url === 'string' && meta.url.trim()) return meta.url;
  }
  return null;
};

export function EvidenceManager() {
  const [currentCase, setCurrentCase] = createSignal<Case | null>(null);
  const [selectedEvidence, setSelectedEvidence] = createSignal<SelectedEvidence | null>(null);
  const [currentPath, setCurrentPath] = createSignal('');
  const [lockerSlots, setLockerSlots] = createSignal<LockerSlot[]>([]);
  const [lockerTerminalId, setLockerTerminalId] = createSignal<string | null>(null);
  const [lockerBusy, setLockerBusy] = createSignal(false);
  const [selectedStagingPhotoId, setSelectedStagingPhotoId] = createSignal<string | null>(null);

  const selectedStagingPhoto = createMemo(() =>
    photoState.stagingPhotos.find((photo) => photo.photoId === selectedStagingPhotoId()) || null
  );

  const getEvidenceIcon = (type: string) => {
    const icons: Record<string, string> = {
      'PHOTO': '📷',
      'VIDEO': '🎥',
      'AUDIO': '🎵',
      'DOCUMENT': '📄',
      'WEAPON': '🔫',
      'BIOLOGICAL': '🧬',
      'STATEMENT': '📝',
      'PHYSICAL': '📦',
      'FINGERPRINT': '🔍',
      'BLOOD': '🩸',
      'DNA': '🧬',
      'CASING': '🔫',
      'BULLET': '💥',
      'FIBERS': '🧵',
      'TOOL_MARKS': '🔧'
    };
    return icons[type] || '📎';
  };

  const buildEvidenceFileName = (id: string, evidenceType: string) =>
    `${id}::${evidenceType}`;

  const getEvidenceIdFromFile = (fileName: string) => {
    const separatorIndex = fileName.indexOf('::');
    if (separatorIndex === -1) {
      return fileName;
    }
    return fileName.slice(0, separatorIndex);
  };

  const getCaseEvidence = (caseId: string) => cadState.cases[caseId]?.evidence || [];

  const allEvidenceFiles = createMemo<FileItem[]>(() => {
    const files: FileItem[] = [];
    
    files.push({
      name: '📁 STAGING',
      type: 'folder',
      path: '',
      modified: new Date(),
      icon: '📂'
    });
    
    cadState.stagingEvidence.forEach(ev => {
      files.push({
        name: buildEvidenceFileName(ev.stagingId, ev.evidenceType),
        type: 'file',
        path: 'staging',
        size: JSON.stringify(ev.data).length,
        modified: new Date(ev.createdAt),
        icon: getEvidenceIcon(ev.evidenceType)
      });
    });
    
    Object.entries(cadState.cases).forEach(([caseId, caseData]) => {
      const evidenceList = caseData.evidence || [];
      
      const folderName = `📁 ${caseId} - ${caseData.title}`;
      files.push({
        name: folderName,
        type: 'folder',
        path: '',
        modified: new Date(),
        icon: '📂'
      });
      
      evidenceList.forEach(ev => {
        files.push({
          name: buildEvidenceFileName(ev.evidenceId, ev.evidenceType),
          type: 'file',
          path: `cases/${caseId}`,
          size: JSON.stringify(ev.data).length,
          modified: new Date(ev.attachedAt),
          icon: getEvidenceIcon(ev.evidenceType)
        });
      });
    });
    
    return files;
  });

  const filteredFiles = createMemo<FileItem[]>(() => {
    const path = currentPath();
    if (!path) {
      return allEvidenceFiles().filter(item => 
        item.type === 'folder' || item.path === 'staging'
      );
    }
    return allEvidenceFiles().filter(item => item.path === path);
  });

  const resolveLockerContext = async (quiet = false) => {
    const context = await fetchNui<{
      ok: boolean;
      terminalId?: string;
      hasContainer?: boolean;
      error?: string;
    }>('cad:getComputerContext');

    if (!context?.ok || !context.terminalId || !context.hasContainer) {
      if (!quiet) {
        terminalActions.addLine(`Evidence locker unavailable: ${context?.error || 'no_terminal_container'}`, 'error');
      }
      return null;
    }

    return context.terminalId;
  };

  const loadLocker = async () => {
    if (lockerBusy()) {
      return;
    }

    setLockerBusy(true);
    try {
      const terminalId = await resolveLockerContext(true);
      if (!terminalId) {
        setLockerSlots([]);
        setLockerTerminalId(null);
        return;
      }

      const response = await fetchNui<{
        ok: boolean;
        terminalId?: string;
        slots?: LockerSlot[];
        error?: string;
      }>('cad:evidence:container:list', { terminalId });

      if (!response?.ok) {
        terminalActions.addLine(`Failed to load evidence locker: ${response?.error || 'unknown_error'}`, 'error');
        return;
      }

      setLockerTerminalId(response.terminalId || terminalId);
      setLockerSlots(Array.isArray(response.slots) ? response.slots : []);
    } catch (error) {
      terminalActions.addLine(`Failed to load evidence locker: ${error}`, 'error');
    } finally {
      setLockerBusy(false);
    }
  };

  const handleStoreToLocker = async () => {
    const selected = selectedEvidence();
    if (!selected || !('stagingId' in selected)) {
      terminalActions.addLine('Select staging evidence to store in locker', 'error');
      return;
    }

    if (lockerBusy()) {
      return;
    }

    setLockerBusy(true);
    try {
      const terminalId = lockerTerminalId() || (await resolveLockerContext(false));
      if (!terminalId) {
        return;
      }

      const response = await fetchNui<{
        ok: boolean;
        slot?: number;
        error?: string;
      }>('cad:evidence:container:store', {
        terminalId,
        stagingId: selected.stagingId,
      });

      if (!response?.ok) {
        terminalActions.addLine(`Failed to store evidence: ${response?.error || 'unknown_error'}`, 'error');
        return;
      }

      cadActions.removeStagingEvidence(selected.stagingId);
      setSelectedEvidence(null);
      terminalActions.addLine(`✓ Evidence stored in locker slot ${response.slot || '?'}`, 'output');
      await loadLocker();
    } catch (error) {
      terminalActions.addLine(`Failed to store evidence: ${error}`, 'error');
    } finally {
      setLockerBusy(false);
    }
  };

  const handlePullFromLocker = async (slot: number) => {
    if (lockerBusy()) {
      return;
    }

    setLockerBusy(true);
    try {
      const terminalId = lockerTerminalId() || (await resolveLockerContext(false));
      if (!terminalId) {
        return;
      }

      const response = await fetchNui<{
        ok: boolean;
        slot?: number;
        staging?: StagingEvidence;
        error?: string;
      }>('cad:evidence:container:pull', {
        terminalId,
        slot,
      });

      if (!response?.ok || !response.staging) {
        terminalActions.addLine(`Failed to pull evidence: ${response?.error || 'unknown_error'}`, 'error');
        return;
      }

      cadActions.addStagingEvidence(response.staging);
      terminalActions.addLine(`✓ Evidence pulled from locker slot ${response.slot || slot}`, 'output');
      await loadLocker();
    } catch (error) {
      terminalActions.addLine(`Failed to pull evidence: ${error}`, 'error');
    } finally {
      setLockerBusy(false);
    }
  };

  onMount(() => {
    void loadLocker();
    void photoActions.fetchStagingPhotos();
  });

  const handleAttachStagingPhotoToCase = async () => {
    const photo = selectedStagingPhoto();
    const targetCase = currentCase();
    if (!photo || !targetCase) {
      terminalActions.addLine('Select a staging photo and target case first', 'error');
      return;
    }

    const result = await photoActions.attachToCase(photo.photoId, targetCase.caseId);
    if (!result.success) {
      terminalActions.addLine(`Failed to attach photo: ${String(result.error || 'unknown_error')}`, 'error');
      return;
    }

    terminalActions.addLine(`Photo ${photo.photoId} attached to case ${targetCase.caseId}`, 'output');
    setSelectedStagingPhotoId(null);
  };

  const viewStagingPhoto = (photo: PhotoMetadata) => {
    viewerActions.openImage(photo.photoUrl, `Staging Photo - ${photo.photoId}`);
  };

  const closeModal = () => {
    terminalActions.setActiveModal(null);
  };

  const handleFileSelect = (item: FileItem) => {
    if (item.type === 'folder') {
      if (item.name.includes('STAGING')) {
        setCurrentPath('staging');
      } else {
        const match = item.name.match(/📁 ([^\s]+)/);
        const caseId = match ? match[1] : item.name.replace('📁 ', '');
        setCurrentPath(`cases/${caseId}`);
      }
      setSelectedEvidence(null);
      return;
    }
    
    const evidenceId = getEvidenceIdFromFile(item.name);
    
    if (item.path === 'staging') {
      const ev = cadState.stagingEvidence.find(e => e.stagingId === evidenceId);
      if (ev) {
        setSelectedEvidence(ev);
        setCurrentCase(null);
      }
    } else if (item.path && item.path.startsWith('cases/')) {
      const caseId = item.path.replace('cases/', '');
      const ev = getCaseEvidence(caseId).find(e => e.evidenceId === evidenceId);
      if (ev) {
        setSelectedEvidence(ev);
        setCurrentCase(cadState.cases[caseId]);
      }
    }
  };

  const handleFileOpen = (item: FileItem) => {
    if (item.type === 'folder') {
      handleFileSelect(item);
      return;
    }
    
    const evidenceId = getEvidenceIdFromFile(item.name);
    let ev: Evidence | StagingEvidence | undefined;
    
    if (item.path === 'staging') {
      ev = cadState.stagingEvidence.find(e => e.stagingId === evidenceId);
    } else if (item.path && item.path.startsWith('cases/')) {
      const caseId = item.path.replace('cases/', '');
      ev = getCaseEvidence(caseId).find(e => e.evidenceId === evidenceId);
    }
    
    if (ev) {
      const data = ev.data as {
        url?: string;
        images?: string[];
        content?: string;
        text?: string;
        description?: string;
        notes?: string;
      };
      
      if (data.images && Array.isArray(data.images) && data.images.length > 0) {
        viewerActions.openImages(data.images, `${ev.evidenceType} - ${evidenceId}`);
        return;
      }
      
      const url = data.url;
      
      // Helper functions for URL detection by extension only << stack overflow :)
      const isImageUrl = (url: string): boolean => {
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
        const lower = url.toLowerCase();
        return imageExtensions.some(ext => lower.endsWith(ext));
      };

      const isVideoUrl = (url: string): boolean => {
        const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov'];
        const lower = url.toLowerCase();
        return videoExtensions.some(ext => lower.endsWith(ext));
      };

      const isAudioUrl = (url: string): boolean => {
        const audioExtensions = ['.mp3', '.wav', '.ogg', '.m4a', '.aac'];
        const lower = url.toLowerCase();
        return audioExtensions.some(ext => lower.endsWith(ext));
      };

      if (url) {
        if (ev.evidenceType === 'VIDEO' || isVideoUrl(url)) {
          viewerActions.openVideo(url, `${ev.evidenceType} - ${evidenceId}`);
          return;
        }

        if (ev.evidenceType === 'AUDIO' || isAudioUrl(url)) {
          viewerActions.openAudio(url, `${ev.evidenceType} - ${evidenceId}`);
          return;
        }

        if (isImageUrl(url)) {
          viewerActions.openImage(url, `${ev.evidenceType} - ${evidenceId}`);
          return;
        }
      }

      const hasDocumentPayload =
        ev.evidenceType === 'DOCUMENT' ||
        ev.evidenceType === 'DIGITAL' ||
        ev.evidenceType === 'BIOLOGICAL' ||
        ev.evidenceType === 'DNA' ||
        ev.evidenceType === 'BLOOD' ||
        ev.evidenceType === 'FINGERPRINT' ||
        (typeof data.content === 'string' && data.content.trim() !== '') ||
        (typeof data.text === 'string' && data.text.trim() !== '') ||
        (typeof data.description === 'string' && data.description.trim() !== '') ||
        (typeof data.notes === 'string' && data.notes.trim() !== '') ||
        typeof data.url === 'string';

      if (hasDocumentPayload) {
        terminalActions.setActiveModal('EVIDENCE_DOCUMENT', {
          title: `${ev.evidenceType} - ${evidenceId}`,
          evidenceId,
          evidenceType: ev.evidenceType,
          payload: data,
        });
      }
    }
  };

  const handleNavigate = (path: string) => {
    setCurrentPath(path);
    setSelectedEvidence(null);

    if (path.startsWith('cases/')) {
      const caseId = path.replace('cases/', '');
      setCurrentCase(cadState.cases[caseId] || null);
      return;
    }

    if (path === '' || path === 'staging') {
      setCurrentCase(null);
    }
  };

  const handleAttachToCase = async () => {
    if (!selectedEvidence() || !currentCase()) return;
    
    try {
      const stagingItem = cadState.stagingEvidence.find(
        e => e.stagingId === (selectedEvidence() as StagingEvidence).stagingId
      );
      if (!stagingItem) return;

      const result = await fetchNui('cad:attachEvidence', {
        stagingId: stagingItem.stagingId,
        caseId: currentCase()!.caseId
      });

      if (!isEvidence(result)) {
        terminalActions.addLine('Failed to attach evidence: invalid response payload', 'error');
        return;
      }

      cadActions.removeStagingEvidence(stagingItem.stagingId);
      cadActions.addCaseEvidence(currentCase()!.caseId, result);
      terminalActions.addLine(`Evidence attached to case ${currentCase()!.caseId}`, 'output');
      setSelectedEvidence(null);
      setCurrentPath(''); 
    } catch (error) {
      terminalActions.addLine(`Failed to attach evidence: ${error}`, 'error');
    }
  };

  const handleDeleteEvidence = async () => {
    if (!selectedEvidence()) return;
    
    const ev = selectedEvidence()!;
    if ('stagingId' in ev) {
      try {
        const result = await fetchNui('cad:removeFromStaging', ev.stagingId);
        if (result) {
          cadActions.removeStagingEvidence(ev.stagingId);
          terminalActions.addLine(`Evidence removed from staging`, 'output');
          setSelectedEvidence(null);
        }
      } catch (error) {
        terminalActions.addLine(`Failed to remove evidence: ${error}`, 'error');
      }
    }
  };

  return (
        <Modal.Root onClose={closeModal} useContentWrapper={false}>
      <div class="modal-content evidence-manager" onClick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h2>=== EVIDENCE MANAGER ===</h2>
          <button class="modal-close" onClick={closeModal}>[X]</button>
        </div>

        <div class="evidence-toolbar">
          <div class="view-toggle">
            <button 
              class={`btn ${currentPath() === '' ? 'btn-primary' : ''}`}
              onClick={() => { setCurrentPath(''); setSelectedEvidence(null); }}
            >
              [ROOT]
            </button>
            <button 
              class={`btn ${currentPath() === 'staging' ? 'btn-primary' : ''}`}
              onClick={() => { setCurrentPath('staging'); setSelectedEvidence(null); }}
            >
              [STAGING ({cadState.stagingEvidence.length})]
            </button>
            <Select.Root
              class="dos-select"
              value={currentCase()?.caseId || ''}
              onChange={(e) => {
                const caseId = e.currentTarget.value;
                if (!caseId) {
                  setCurrentCase(null);
                  return;
                }
                const caseData = cadState.cases[caseId] || null;
                setCurrentCase(caseData);
                setCurrentPath(`cases/${caseId}`);
                setSelectedEvidence(null);
              }}
            >
              <option value="">Target Case...</option>
              {Object.values(cadState.cases).map((caseItem) => (
                <option value={caseItem.caseId}>{caseItem.caseId} - {caseItem.title}</option>
              ))}
            </Select.Root>
            <Button.Root class="btn" onClick={() => void loadLocker()} disabled={lockerBusy()}>
              [LOCKER REFRESH]
            </Button.Root>
            <Button.Root
              class="btn"
              onClick={() => void handleStoreToLocker()}
              disabled={lockerBusy() || !selectedEvidence() || !('stagingId' in selectedEvidence()!)}
            >
              [STORE TO LOCKER]
            </Button.Root>
          </div>
          
          <div class="evidence-breadcrumb">
            <Show when={currentPath()} fallback={<span class="breadcrumb-root">📁 Root</span>}>
              <button class="breadcrumb-item" onClick={() => { setCurrentPath(''); setSelectedEvidence(null); }}>
                📁 Root
              </button>
              <span class="breadcrumb-separator">/</span>
              {currentPath() === 'staging' ? (
                <span class="breadcrumb-current">Staging</span>
              ) : (
                <>
                  <span class="breadcrumb-current">
                    {currentPath().replace('cases/', '')}
                  </span>
                </>
              )}
            </Show>
          </div>
        </div>

        <div class="evidence-content">
          <div class="file-explorer-container">
            <FileExplorer
              data={filteredFiles()}
              currentPath={currentPath()}
              height="100%"
              viewMode="details"
              showSearch={true}
              searchPlaceholder="Search evidence..."
              onFileSelect={handleFileSelect}
              onFileOpen={handleFileOpen}
              onNavigate={handleNavigate}
            />
          </div>

          <div class="evidence-preview" style={{ border: '2px solid #ffaa00', padding: '14px', 'max-width': '260px' }}>
            <h3>[LOCKER]</h3>
            <div class="preview-content" style={{ 'font-size': '12px' }}>
              <div><strong>Terminal:</strong> {lockerTerminalId() || 'N/A'}</div>
              <div><strong>Slots:</strong> {lockerSlots().length}</div>
            </div>
            <div style={{ 'margin-top': '10px', 'max-height': '280px', 'overflow-y': 'auto' }}>
              <Show
                when={lockerSlots().length > 0}
                fallback={<div style={{ color: '#808080' }}>Locker empty or unavailable</div>}
              >
                <For each={lockerSlots()}>
                  {(slot) => (
                    <div style={{ border: '1px solid #555', padding: '6px', 'margin-bottom': '6px' }}>
                      <div><strong>SLOT {slot.slot}</strong></div>
                      <div>{slot.label || slot.itemName || 'Evidence'}</div>
                      <div style={{ color: '#c0c0c0' }}>
                        {slot.metadata?.evidenceType || 'UNKNOWN'}
                      </div>
                      <Button.Root
                        class="btn"
                        style={{ 'margin-top': '6px' }}
                        onClick={() => void handlePullFromLocker(slot.slot)}
                        disabled={lockerBusy()}
                      >
                        [PULL]
                      </Button.Root>
                    </div>
                  )}
                </For>
              </Show>
            </div>
          </div>

          <div class="evidence-preview" style={{ border: '2px solid #00ffff', padding: '14px', 'max-width': '280px' }}>
            <h3>[PHOTO STAGING]</h3>
            <div class="preview-content" style={{ 'font-size': '12px' }}>
              <div><strong>Items:</strong> {photoState.stagingPhotos.length}</div>
            </div>
            <div style={{ 'margin-top': '10px', 'max-height': '280px', 'overflow-y': 'auto' }}>
              <Show
                when={photoState.stagingPhotos.length > 0}
                fallback={<div style={{ color: '#808080' }}>No staged photos</div>}
              >
                <For each={photoState.stagingPhotos}>
                  {(photo) => (
                    <button
                      type="button"
                      onClick={() => setSelectedStagingPhotoId(photo.photoId)}
                      style={{
                        width: '100%',
                        border: selectedStagingPhotoId() === photo.photoId ? '1px solid #00ffff' : '1px solid #555',
                        'background-color': selectedStagingPhotoId() === photo.photoId ? 'rgba(0,255,255,0.12)' : 'rgba(0,0,0,0.35)',
                        color: 'inherit',
                        padding: '6px',
                        'margin-bottom': '6px',
                        'text-align': 'left',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <img
                          src={photo.photoUrl}
                          alt={photo.photoId}
                          style={{ width: '62px', height: '44px', 'object-fit': 'cover', border: '1px solid #444' }}
                        />
                        <div style={{ flex: 1, 'min-width': 0 }}>
                          <div style={{ color: '#00ffff', 'font-size': '11px', 'white-space': 'nowrap', overflow: 'hidden', 'text-overflow': 'ellipsis' }}>
                            {photo.photoId}
                          </div>
                          <div style={{ color: '#c0c0c0', 'font-size': '11px' }}>
                            {new Date(photo.takenAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </button>
                  )}
                </For>
              </Show>
            </div>
            <Show when={selectedStagingPhoto()}>
              <div style={{ 'margin-top': '10px', 'border-top': '1px solid #444', padding: '8px 0 0' }}>
                <div style={{ 'font-size': '11px', color: '#c0c0c0', 'margin-bottom': '6px' }}>
                  {selectedStagingPhoto()!.description || 'No description'}
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <Button.Root class="btn" onClick={() => viewStagingPhoto(selectedStagingPhoto()!)}>[VIEW]</Button.Root>
                  <Button.Root
                    class="btn btn-primary"
                    onClick={() => void handleAttachStagingPhotoToCase()}
                    disabled={!currentCase()}
                  >
                    [ATTACH]
                  </Button.Root>
                </div>
              </div>
            </Show>
          </div>

          <Show when={selectedEvidence()}>
            <div class="evidence-preview" style={{ border: '2px solid #00ff00', padding: '20px' }}>
              <h3>[EVIDENCE DETAILS]</h3>
              <div class="preview-content" style={{ 'font-size': '14px', 'line-height': '1.6' }}>
                <div><strong>ID:</strong> {('stagingId' in selectedEvidence()!) ? (selectedEvidence() as StagingEvidence).stagingId : (selectedEvidence() as Evidence).evidenceId}</div>
                <div><strong>Type:</strong> {selectedEvidence()!.evidenceType}</div>
                <div><strong>Date:</strong> {new Date(('createdAt' in selectedEvidence()!) ? (selectedEvidence() as StagingEvidence).createdAt : (selectedEvidence() as Evidence).attachedAt).toLocaleString()}</div>
                
                <Show when={extractUrl(selectedEvidence()!.data)}>
                  <div style={{ 'margin-top': '12px', 'word-break': 'break-all' }}>
                    <strong>URL:</strong><br/>
                    <a href={extractUrl(selectedEvidence()!.data)!} target="_blank" style={{ color: '#00ffff' }}>
                      {extractUrl(selectedEvidence()!.data)}
                    </a>
                  </div>
                  <Button.Root 
                    class="btn btn-primary" 
                    style={{ 'margin-top': '8px' }}
                    onClick={() => {
                      const ev = selectedEvidence()!;
                      const url = extractUrl(ev.data)!;
                      const title = `${ev.evidenceType} - ${('stagingId' in ev) ? (ev as StagingEvidence).stagingId : (ev as Evidence).evidenceId}`;
                      
                      const isVideo = ev.evidenceType === 'VIDEO' || ev.evidenceType === 'VIDEO_URL' || url.match(/\.(mp4|webm|ogg|mov)$/i);
                      const isAudio = ev.evidenceType === 'AUDIO' || ev.evidenceType === 'AUDIO_URL' || url.match(/\.(mp3|wav|ogg|m4a|aac)$/i);
                      
                      if (isVideo) {
                        viewerActions.openVideo(url, title);
                      } else if (isAudio) {
                        viewerActions.openAudio(url, title);
                      } else {
                        viewerActions.openImage(url, title);
                      }
                    }}
                  >
                    [VIEW {(() => {
                      const ev = selectedEvidence()!;
                      const url = extractUrl(ev.data) || '';
                      const isVideo = ev.evidenceType === 'VIDEO' || ev.evidenceType === 'VIDEO_URL' || url.match(/\.(mp4|webm|ogg|mov)$/i);
                      const isAudio = ev.evidenceType === 'AUDIO' || ev.evidenceType === 'AUDIO_URL' || url.match(/\.(mp3|wav|ogg|m4a|aac)$/i);
                      return isVideo ? 'VIDEO' : isAudio ? 'AUDIO' : 'IMAGE';
                    })()}]
                  </Button.Root>
                </Show>
                
                <Show when={(selectedEvidence()!.data as { description?: string })?.description}>
                  <div style={{ 'margin-top': '12px' }}>
                    <strong>Description:</strong><br/>
                    {(selectedEvidence()!.data as { description?: string }).description}
                  </div>
                </Show>
                
                <Show when={('attachedBy' in selectedEvidence()!)}>
                  <div><strong>Attached By:</strong> {(selectedEvidence() as Evidence).attachedBy}</div>
                  <div><strong>Current Location:</strong> {(selectedEvidence() as Evidence).currentLocation || 'Unknown'}</div>
                  <div><strong>Custodian:</strong> {(selectedEvidence() as Evidence).currentCustodian || 'Unknown'}</div>
                </Show>
              </div>

              <Show when={('custodyChain' in selectedEvidence()!) && (selectedEvidence() as Evidence).custodyChain?.length > 0}>
                <div class="custody-chain-section" style={{ 'margin-top': '20px', 'border-top': '2px solid #ffff00', 'padding-top': '16px' }}>
                  <h4 style={{ color: '#ffff00', 'margin-bottom': '12px' }}>📋 CHAIN OF CUSTODY</h4>
                  <div class="custody-timeline" style={{ 'max-height': '200px', 'overflow-y': 'auto' }}>
                    <For each={(selectedEvidence() as Evidence).custodyChain}>
                      {(event) => (
                        <div class="custody-event" style={{ 
                          'display': 'flex', 
                          'gap': '12px', 
                          'padding': '8px 0',
                          'border-left': '2px solid var(--terminal-system)',
                          'padding-left': '12px',
                          'margin-left': '6px',
                          'position': 'relative'
                        }}>
                          <div style={{ 'min-width': '60px', 'color': 'var(--terminal-fg-dim)', 'font-size': '11px' }}>
                            {new Date(event.timestamp).toLocaleDateString()}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ 'font-weight': 'bold', 'color': 'var(--terminal-system-bright)' }}>
                              {event.eventType}
                            </div>
                            <Show when={event.fromOfficer || event.toOfficer}>
                              <div style={{ 'font-size': '12px' }}>
                                {event.fromOfficer && `From: ${event.fromOfficer}`}
                                {event.fromOfficer && event.toOfficer && ' → '}
                                {event.toOfficer && `To: ${event.toOfficer}`}
                              </div>
                            </Show>
                            <Show when={event.location}>
                              <div style={{ 'font-size': '12px', 'color': 'var(--terminal-fg-dim)' }}>
                                📍 {event.location}
                              </div>
                            </Show>
                            <Show when={event.notes}>
                              <div style={{ 'font-size': '11px', 'color': 'var(--terminal-fg-dim)', 'margin-top': '4px' }}>
                                {event.notes}
                              </div>
                            </Show>
                            <div style={{ 'font-size': '10px', 'color': 'var(--terminal-fg-dim)', 'margin-top': '4px' }}>
                              Recorded by: {event.recordedBy}
                            </div>
                          </div>
                        </div>
                      )}
                    </For>
                  </div>
                  
                  <Show when={currentPath() !== 'staging' && currentCase()}>
                    <Button.Root 
                      class="btn" 
                      style={{ 'margin-top': '12px' }}
                      onClick={() => {
                        const ev = selectedEvidence() as Evidence;
                        const newEvent: CustodyEvent = {
                          eventId: `CUSTODY_${Date.now()}`,
                          evidenceId: ev.evidenceId,
                          eventType: 'TRANSFERRED',
                          fromOfficer: ev.currentCustodian || userActions.getCurrentUserId(),
                          toOfficer: userActions.getCurrentUserId(),
                          location: ev.currentLocation || 'Evidence Storage',
                          notes: 'Routine custody transfer',
                          timestamp: new Date().toISOString(),
                          recordedBy: userActions.getCurrentUserId(),
                        };
                        cadActions.addCustodyEvent(currentCase()!.caseId, ev.evidenceId, newEvent);
                      }}
                    >
                      [+ LOG TRANSFER]
                    </Button.Root>
                  </Show>
                </div>
              </Show>

              <div class="preview-actions" style={{ 'margin-top': '16px', display: 'flex', gap: '12px' }}>
                <Show when={currentPath() === 'staging' && currentCase()}>
                  <Button.Root class="btn btn-primary" onClick={handleAttachToCase}>
                    [ATTACH TO {currentCase()!.caseId}]
                  </Button.Root>
                </Show>
                <Show when={currentPath() === 'staging'}>
                  <Button.Root class="btn" onClick={handleDeleteEvidence}>
                    [DELETE]
                  </Button.Root>
                </Show>
                <Show when={selectedEvidence() && (selectedEvidence()!.evidenceType === 'BIOLOGICAL' || selectedEvidence()!.evidenceType === 'DNA' || selectedEvidence()!.evidenceType === 'BLOOD')}>
                  <Button.Root 
                    class="btn btn-primary" 
                    style={{ 'background-color': '#ff00ff', 'border-color': '#ff00ff' }}
                    onClick={() => {
                      const ev = selectedEvidence()!;
                      const evidenceId = ('stagingId' in ev) ? (ev as StagingEvidence).stagingId : (ev as Evidence).evidenceId;
                      const caseId = currentCase()?.caseId;
                      
                      if (!caseId) {
                        terminalActions.addLine('No active case selected', 'error');
                        return;
                      }
                      
                      cadActions.requestEvidenceAnalysis(caseId, evidenceId, 'OFFICER_001', 'Requested forensic analysis');
                      terminalActions.addLine(`Analysis request submitted for evidence ${evidenceId}`, 'output');
                    }}
                  >
                    [REQUEST ANALYSIS]
                  </Button.Root>
                </Show>
              </div>
            </div>
          </Show>
        </div>

        <div class="modal-footer">
          <span style={{ color: '#808080' }}>
            Path: {currentPath() || 'root'} | 
            Items: {filteredFiles().length}
          </span>
          <Button.Root class="btn" onClick={closeModal}>[CLOSE]</Button.Root>
        </div>
      </div>
    </Modal.Root>
  );
}
