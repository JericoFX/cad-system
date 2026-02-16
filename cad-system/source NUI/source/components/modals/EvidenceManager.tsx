import { createSignal, createMemo, Show, For } from 'solid-js';
import { terminalActions } from '~/stores/terminalStore';
import { cadActions, cadState } from '~/stores/cadStore';
import { viewerActions } from '~/stores/viewerStore';
import { fetchNui } from '~/utils/fetchNui';
import type { Evidence, Case, StagingEvidence, CustodyEvent } from '~/stores/cadStore';
import { userActions } from '~/stores/userStore';
import type { FileItem } from '../FileExplorer.types';

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

const FileExplorer = (await import('../FileExplorer')).FileExplorer;

export function EvidenceManager() {
  const [currentCase, setCurrentCase] = createSignal<Case | null>(null);
  const [selectedEvidence, setSelectedEvidence] = createSignal<SelectedEvidence | null>(null);
  const [currentPath, setCurrentPath] = createSignal('');

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
      
      // Always show case folder, even if empty
      const folderName = `📁 ${caseId} - ${caseData.title}`;
      files.push({
        name: folderName,
        type: 'folder',
        path: '',
        modified: new Date(),
        icon: '📂'
      });
      
      // Only add evidence files if they exist
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
      
      // Helper functions for URL detection by extension only
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

      // Priority: 1) evidenceType explicit, 2) URL extension
      if (url) {
        // VIDEO first (explicit type or extension)
        if (ev.evidenceType === 'VIDEO' || isVideoUrl(url)) {
          viewerActions.openVideo(url, `${ev.evidenceType} - ${evidenceId}`);
          return;
        }

        // AUDIO second (explicit type or extension)
        if (ev.evidenceType === 'AUDIO' || isAudioUrl(url)) {
          viewerActions.openAudio(url, `${ev.evidenceType} - ${evidenceId}`);
          return;
        }

        // IMAGE last (by extension only)
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
      setCurrentPath(''); // Go back to root to see updated structure
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
    <div class="modal-overlay" onClick={closeModal}>
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
            <select
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
            </select>
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

          <Show when={selectedEvidence()}>
            <div class="evidence-preview" style={{ border: '2px solid #00ff00', padding: '20px' }}>
              <h3>[EVIDENCE DETAILS]</h3>
              <div class="preview-content" style={{ 'font-size': '14px', 'line-height': '1.6' }}>
                <div><strong>ID:</strong> {('stagingId' in selectedEvidence()!) ? (selectedEvidence() as StagingEvidence).stagingId : (selectedEvidence() as Evidence).evidenceId}</div>
                <div><strong>Type:</strong> {selectedEvidence()!.evidenceType}</div>
                <div><strong>Date:</strong> {new Date(('createdAt' in selectedEvidence()!) ? (selectedEvidence() as StagingEvidence).createdAt : (selectedEvidence() as Evidence).attachedAt).toLocaleString()}</div>
                
                <Show when={(selectedEvidence()!.data as { url?: string })?.url}>
                  <div style={{ 'margin-top': '12px', 'word-break': 'break-all' }}>
                    <strong>URL:</strong><br/>
                    <a href={(selectedEvidence()!.data as { url?: string }).url} target="_blank" style={{ color: '#00ffff' }}>
                      {(selectedEvidence()!.data as { url?: string }).url}
                    </a>
                  </div>
                  <button 
                    class="btn btn-primary" 
                    style={{ 'margin-top': '8px' }}
                    onClick={() => {
                      const ev = selectedEvidence()!;
                      const url = (ev.data as { url?: string }).url!;
                      const title = `${ev.evidenceType} - ${('stagingId' in ev) ? (ev as StagingEvidence).stagingId : (ev as Evidence).evidenceId}`;
                      
                      // Detect media type
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
                      const url = (ev.data as { url?: string }).url || '';
                      const isVideo = ev.evidenceType === 'VIDEO' || ev.evidenceType === 'VIDEO_URL' || url.match(/\.(mp4|webm|ogg|mov)$/i);
                      const isAudio = ev.evidenceType === 'AUDIO' || ev.evidenceType === 'AUDIO_URL' || url.match(/\.(mp3|wav|ogg|m4a|aac)$/i);
                      return isVideo ? 'VIDEO' : isAudio ? 'AUDIO' : 'IMAGE';
                    })()}]
                  </button>
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
                    <button 
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
                    </button>
                  </Show>
                </div>
              </Show>

              <div class="preview-actions" style={{ 'margin-top': '16px', display: 'flex', gap: '12px' }}>
                <Show when={currentPath() === 'staging' && currentCase()}>
                  <button class="btn btn-primary" onClick={handleAttachToCase}>
                    [ATTACH TO {currentCase()!.caseId}]
                  </button>
                </Show>
                <Show when={currentPath() === 'staging'}>
                  <button class="btn" onClick={handleDeleteEvidence}>
                    [DELETE]
                  </button>
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
          <button class="btn" onClick={closeModal}>[CLOSE]</button>
        </div>
      </div>
    </div>
  );
}
