import { createSignal, createMemo, Show, For, onMount } from 'solid-js';
import { terminalActions, terminalState } from '~/stores/terminalStore';
import { cadState, cadActions } from '~/stores/cadStore';
import { userActions } from '~/stores/userStore';
import { DosSelect } from '../DosSelect';
import type { Case, Note } from '~/stores/cadStore';
import { Button, Modal, Select, Textarea } from '~/components/ui';

export function NotesEditor() {
  const modalData = terminalState.modalData as { caseId?: string } | null;
  const [currentCase, setCurrentCase] = createSignal<Case | null>(null);

  onMount(() => {
    if (modalData?.caseId) {
      const c = Object.values(cadState.cases).find(c => c.caseId === modalData.caseId);
      if (c) {
        setCurrentCase(c);
      }
    }
  });
  const [newNote, setNewNote] = createSignal('');
  const [noteType, setNoteType] = createSignal<Note['type']>('general');
  const [selectedNote, setSelectedNote] = createSignal<Note | null>(null);
  const [isEditing, setIsEditing] = createSignal(false);

  const caseNotes = createMemo(() => {
    if (!currentCase()) return [];
    return currentCase()!.notes || [];
  });

  const noteTypeOptions = [
    { value: 'general', label: 'GENERAL', color: '' },
    { value: 'observation', label: 'OBSERVATION', color: 'type-police' },
    { value: 'interview', label: 'INTERVIEW', color: 'priority-med' },
    { value: 'evidence', label: 'EVIDENCE', color: 'priority-low' },
  ];

  const closeModal = () => {
    terminalActions.setActiveModal(null, null);
  };

  const handleAddNote = () => {
    if (!newNote().trim() || !currentCase()) return;

    const note: Note = {
      id: `NOTE_${Date.now()}`,
      caseId: currentCase()!.caseId,
      author: userActions.getCurrentUserId(),
      content: newNote(),
      timestamp: new Date().toISOString(),
      type: noteType()
    };

    cadActions.addCaseNote(currentCase()!.caseId, note);
    setNewNote('');
    terminalActions.addLine(`Note added to case ${currentCase()!.caseId}`, 'output');
  };

  const handleDeleteNote = (noteId: string) => {
    if (!currentCase()) return;
    cadActions.removeCaseNote(currentCase()!.caseId, noteId);
    setSelectedNote(null);
    terminalActions.addLine('Note deleted', 'output');
  };

  const handleUpdateNote = () => {
    if (!selectedNote() || !newNote().trim() || !currentCase()) return;

    cadActions.updateCaseNote(currentCase()!.caseId, selectedNote()!.id, {
      content: newNote(),
      type: noteType()
    });
    setIsEditing(false);
    setSelectedNote(null);
    setNewNote('');
    terminalActions.addLine('Note updated', 'output');
  };

  const startEdit = (note: Note) => {
    setSelectedNote(note);
    setNewNote(note.content);
    setNoteType(note.type);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setSelectedNote(null);
    setNewNote('');
    setNoteType('general');
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
        <Modal.Root onClose={closeModal} useContentWrapper={false}>
      <div class="modal-content notes-editor" onClick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h2>=== CASE NOTES ===</h2>
          <button class="modal-close" onClick={closeModal}>[X]</button>
        </div>

        <div class="notes-toolbar">
          <Select.Root 
            class="dos-select"
            value={currentCase()?.caseId || ''}
            onChange={(e) => {
              const caseId = e.currentTarget.value;
              const c = Object.values(cadState.cases).find(c => c.caseId === caseId);
              setCurrentCase(c || null);
              setSelectedNote(null);
              setIsEditing(false);
            }}
          >
            <option value="">SELECT CASE...</option>
            {Object.values(cadState.cases).map(c => (
              <option value={c.caseId}>{c.caseId} - {c.title}</option>
            ))}
          </Select.Root>

          <Show when={currentCase()}>
            <div class="notes-stats">
              [{caseNotes().length} NOTES]
            </div>
          </Show>
        </div>

        <Show when={currentCase()} fallback={
          <div class="notes-empty">
            <div style={{ color: '#ffff00', "text-align": 'center', padding: '40px' }}>
              SELECT A CASE TO VIEW NOTES
            </div>
          </div>
        }>
          <div class="notes-content">
            <div class="notes-list">
              <For each={caseNotes()}>
                {(note) => {
                  const typeInfo = noteTypeOptions.find(t => t.value === note.type);
                  return (
                    <div 
                      class={`note-item ${selectedNote()?.id === note.id ? 'selected' : ''}`}
                      onClick={() => setSelectedNote(note)}
                    >
                      <div class="note-header">
                        <span class={typeInfo?.color || ''}>[{typeInfo?.label}]</span>
                        <span class="note-date">{formatDate(note.timestamp)}</span>
                      </div>
                      <div class="note-preview">
                        {note.content.substring(0, 60)}{note.content.length > 60 ? '...' : ''}
                      </div>
                      <div class="note-author">By: {note.author}</div>
                    </div>
                  );
                }}
              </For>

              {caseNotes().length === 0 && (
                <div class="notes-empty-item">
                  NO NOTES FOR THIS CASE
                </div>
              )}
            </div>

            <div class="notes-editor-panel">
              <Show when={selectedNote() && !isEditing()}>
                <div class="note-view">
                  <div class="note-view-header">
                    <span style={{ 
                      color: noteTypeOptions.find(t => t.value === selectedNote()!.type)?.color 
                    }}>
                      [{noteTypeOptions.find(t => t.value === selectedNote()!.type)?.label}]
                    </span>
                    <span>{formatDate(selectedNote()!.timestamp)}</span>
                  </div>
                  <div class="note-view-content">
                    {selectedNote()!.content}
                  </div>
                  <div class="note-view-author">
                    Author: {selectedNote()!.author}
                  </div>
                  <div class="note-view-actions">
                    <Button.Root class="btn" onClick={() => startEdit(selectedNote()!)}>
                      [EDIT]
                    </Button.Root>
                    <Button.Root class="btn" onClick={() => handleDeleteNote(selectedNote()!.id)}>
                      [DELETE]
                    </Button.Root>
                  </div>
                </div>
              </Show>

              <div class="note-form">
                <div class="form-label">
                  {isEditing() ? '[EDIT NOTE]' : '[ADD NEW NOTE]'}
                </div>

                <DosSelect
                  label="[NOTE TYPE]"
                  options={noteTypeOptions}
                  value={noteType()}
                  onChange={(value) => setNoteType(value as Note['type'])}
                  placeholder="Select note type..."
                />

                <Textarea.Root
                  class="dos-textarea"
                  value={newNote()}
                  onInput={(e) => setNewNote(e.currentTarget.value)}
                  placeholder="Enter note content..."
                  rows={8}
                />

                <div class="form-actions">
                  <Show when={isEditing()}>
                    <Button.Root class="btn btn-primary" onClick={handleUpdateNote}>
                      [UPDATE]
                    </Button.Root>
                    <Button.Root class="btn" onClick={cancelEdit}>
                      [CANCEL]
                    </Button.Root>
                  </Show>
                  <Show when={!isEditing()}>
                    <Button.Root 
                      class="btn btn-primary" 
                      onClick={handleAddNote}
                      disabled={!newNote().trim()}
                    >
                      [ADD NOTE]
                    </Button.Root>
                  </Show>
                </div>
              </div>
            </div>
          </div>
        </Show>

        <div class="modal-footer">
          <Button.Root class="btn" onClick={closeModal}>[CLOSE]</Button.Root>
        </div>
      </div>
    </Modal.Root>
  );
}
