import { createSignal, createMemo, For, Show } from 'solid-js';
import { terminalActions } from '~/stores/terminalStore';
import { cadState } from '~/stores/cadStore';
import { viewerActions } from '~/stores/viewerStore';
import type { Note } from '~/stores/cadStore';
import type { FileItem } from '../FileExplorer.types';
import { Button, Modal, Select } from '~/components/ui';

function NoteReadonlyViewer(props: { note: Note; onClose: () => void }) {
  const noteTypes: Record<string, { label: string; icon: string; color: string }> = {
    'general': { label: 'GENERAL', icon: '📝', color: '#c0c0c0' },
    'observation': { label: 'OBSERVATION', icon: '👁️', color: '#00ffff' },
    'interview': { label: 'INTERVIEW', icon: '🎤', color: '#ffff00' },
    'evidence': { label: 'EVIDENCE', icon: '🔍', color: '#00ff00' },
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
        <Modal.Root onClose={props.onClose} useContentWrapper={false}>
      <div class="modal-content notepad-viewer" onClick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h2>=== NOTEPAD ===</h2>
          <button class="modal-close" onClick={props.onClose}>[X]</button>
        </div>

        <div style={{ padding: '20px' }}>
          <div class="notepad-header">
            <span class="notepad-type" style={{ color: noteTypes[props.note.type]?.color || '#c0c0c0', 'font-weight': 'bold' }}>
              [{noteTypes[props.note.type]?.label || 'NOTE'}]
            </span>
            <span class="notepad-timestamp">
              {formatDate(props.note.timestamp)}
            </span>
          </div>

          <div class="notepad-sheet">
            {props.note.content || '[NO CONTENT]'}
          </div>

          <div class="notepad-meta">
            <div>Author: {props.note.author}</div>
            <div>Case: {props.note.caseId}</div>
            <div>Note ID: {props.note.id}</div>
          </div>
        </div>

        <div class="modal-footer">
          <Button.Root class="btn" onClick={props.onClose}>[CLOSE]</Button.Root>
        </div>
      </div>
    </Modal.Root>
  );
}

const FileExplorer = (await import('../FileExplorer')).FileExplorer;

export function NotesFileManager() {
  const [currentCaseId, setCurrentCaseId] = createSignal<string>('');
  const [currentPath, setCurrentPath] = createSignal<string>('');
  const [selectedNote, setSelectedNote] = createSignal<Note | null>(null);
  const [viewingNote, setViewingNote] = createSignal<Note | null>(null);
  const casesArray = createMemo(() => Object.values(cadState.cases));

  const noteTypes: Record<string, { label: string; icon: string; color: string }> = {
    'general': { label: 'GENERAL', icon: '📝', color: '#c0c0c0' },
    'observation': { label: 'OBSERVATION', icon: '👁️', color: '#00ffff' },
    'interview': { label: 'INTERVIEW', icon: '🎤', color: '#ffff00' },
    'evidence': { label: 'EVIDENCE', icon: '🔍', color: '#00ff00' },
  };

  const isImageUrl = (url: string) => {
    const normalized = url.toLowerCase();
    return (
      /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/.test(normalized) ||
      normalized.includes('imgur.com') ||
      normalized.includes('images')
    );
  };

  const extractImageUrl = (content: string): string | null => {
    const matches = content.match(/https?:\/\/\S+/gi) || [];
    const imageUrl = matches.find((url) => isImageUrl(url));
    return imageUrl || null;
  };

  const getImageNameFromUrl = (url: string): string => {
    try {
      const urlObject = new URL(url);
      const fileName = urlObject.pathname.split('/').pop();
      return fileName && fileName.length > 0 ? fileName : 'attachment.png';
    } catch {
      return 'attachment.png';
    }
  };

  const isImageFileItem = (item: FileItem) => item.name.includes('::IMAGE::');

  const caseNotes = createMemo(() => {
    const caseId = currentCaseId();
    if (!caseId) return [] as Note[];
    return cadState.cases[caseId]?.notes || [];
  });

  const noteFiles = createMemo<FileItem[]>(() => {
    const caseId = currentCaseId();
    if (!caseId) return [];

    const files: FileItem[] = [];

    caseNotes().forEach((note) => {
      const typeInfo = noteTypes[note.type];
      files.push({
        name: `${note.id}::${typeInfo.label}.txt`,
        type: 'file' as const,
        path: `cases/${caseId}/notes`,
        size: note.content.length,
        modified: new Date(note.timestamp),
        icon: typeInfo.icon
      });

      const imageUrl = extractImageUrl(note.content);
      if (imageUrl) {
        files.push({
          name: `${note.id}::IMAGE::${getImageNameFromUrl(imageUrl)}`,
          type: 'file' as const,
          path: `cases/${caseId}/notes`,
          size: imageUrl.length,
          modified: new Date(note.timestamp),
          icon: '🖼️',
        });
      }
    });

    return files;
  });

  const closeModal = () => {
    terminalActions.setActiveModal(null);
  };

  const getNoteIdFromFile = (item: FileItem) => {
    const separatorIndex = item.name.indexOf('::');
    if (separatorIndex === -1) {
      return item.name;
    }
    return item.name.slice(0, separatorIndex);
  };

  const handleFileSelect = (item: FileItem) => {
    const noteId = getNoteIdFromFile(item);
    const note = caseNotes().find(n => n.id === noteId);
    if (note) {
      setSelectedNote(note);
    }
  };

  const handleFileOpen = (item: FileItem) => {
    const noteId = getNoteIdFromFile(item);
    const note = caseNotes().find(n => n.id === noteId);
    if (note) {
      if (isImageFileItem(item)) {
        const imageUrl = extractImageUrl(note.content);
        if (imageUrl) {
          viewerActions.openImage(imageUrl, `${note.id} - IMAGE`);
        }
        return;
      }
      setViewingNote(note);
    }
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const handleNavigate = (path: string) => {
    if (!path.includes('/notes')) {
      setCurrentCaseId('');
      setCurrentPath('');
      setSelectedNote(null);
    } else {
      setCurrentPath(path);
    }
  };

  return (
        <Modal.Root onClose={closeModal} useContentWrapper={false}>
      <div class="modal-content notes-file-manager" onClick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h2>=== NOTES FILE MANAGER ===</h2>
          <button class="modal-close" onClick={closeModal}>[X]</button>
        </div>

        <div class="notes-toolbar">
          <div class="notes-toolbar-left">
            <Select.Root 
              class="dos-select"
              value={currentCaseId()}
              onChange={(e) => {
                const caseId = e.currentTarget.value;
                setCurrentCaseId(caseId);
                setCurrentPath(caseId ? `cases/${caseId}/notes` : '');
                setSelectedNote(null);
              }}
            >
              <option value="">SELECT CASE...</option>
              <For each={casesArray()}>
                {(c) => <option value={c.caseId}>{c.caseId} - {c.title}</option>}
              </For>
            </Select.Root>

            <Show when={currentCaseId()}>
              <div class="notes-stats">
                [{caseNotes().length} NOTES]
              </div>
            </Show>
          </div>

          <Show when={currentCaseId()}>
            <Button.Root 
              class="btn btn-primary back-to-case-btn"
              onClick={() => {
                terminalActions.setActiveModal('CASE_MANAGER', { caseId: currentCaseId() });
              }}
            >
              [← BACK TO CASE]
            </Button.Root>
          </Show>
        </div>

        <Show when={!currentCaseId()}>
          <div class="notes-empty">
            <div style={{ color: '#ffff00', "text-align": 'center', padding: '40px' }}>
              SELECT A CASE TO VIEW NOTES
            </div>
          </div>
        </Show>

        <Show when={currentCaseId()}>
          <div class="notes-file-content">
            <div class="file-explorer-wrapper">
              <FileExplorer
                data={noteFiles()}
                currentPath={currentPath()}
                height="400px"
                viewMode="details"
                showSearch={true}
                searchPlaceholder="Search notes..."
                onFileSelect={handleFileSelect}
                onFileOpen={handleFileOpen}
                onNavigate={handleNavigate}
              />
            </div>

            <Show when={selectedNote()}>
              <div class="note-viewer" style={{ border: '2px solid #ffff00', padding: '20px' }}>
                <div class="note-viewer-header">
                  <span style={{ color: noteTypes[selectedNote()!.type]?.color || '#c0c0c0' }}>
                    [{noteTypes[selectedNote()!.type]?.label || 'NOTE'}]
                  </span>
                  <span>{formatDate(selectedNote()!.timestamp)}</span>
                </div>
                <div class="note-viewer-content" style={{ 
                  'white-space': 'pre-wrap', 
                  'min-height': '200px',
                  'background-color': 'rgba(0,0,0,0.8)',
                  'padding': '16px',
                  'border': '1px solid #00ff00',
                  'margin-top': '12px'
                }}>
                  {selectedNote()!.content || '[NO CONTENT]'}
                </div>
                <div class="note-viewer-meta" style={{ 'margin-top': '16px' }}>
                  <div>Author: {selectedNote()!.author}</div>
                  <div>Case: {selectedNote()!.caseId}</div>
                  <div>Note ID: {selectedNote()!.id}</div>
                </div>
              </div>
            </Show>
          </div>
        </Show>

        <div class="modal-footer">
          <Button.Root class="btn" onClick={closeModal}>[CLOSE]</Button.Root>
        </div>
      </div>
      
      {viewingNote() && (
        <NoteReadonlyViewer 
          note={viewingNote()!} 
          onClose={() => setViewingNote(null)} 
        />
      )}
    </Modal.Root>
  );
}
