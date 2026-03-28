import { createSignal } from 'solid-js';
import type { Accessor, Setter } from 'solid-js';
import { fetchNui } from '~/utils/fetchNui';
import { terminalActions } from '~/stores/terminalStore';

export interface EntityNote {
  id: string;
  content: string;
  author: string;
  authorName?: string;
  timestamp: string;
  important?: boolean;
}

export interface EntityNoteResponse {
  ok?: boolean;
  notes?: EntityNote[];
  note?: EntityNote;
  error?: string;
}

interface UseEntityNotesOptions {
  entityType: 'PERSON' | 'VEHICLE';
  onNotesLoaded?: (entityId: string, notes: EntityNote[]) => void;
  onNoteAdded?: (entityId: string, note: EntityNote) => void;
}

interface UseEntityNotesResult {
  notes: Accessor<EntityNote[]>;
  newNoteContent: Accessor<string>;
  setNewNoteContent: Setter<string>;
  loadNotes: (entityId: string) => Promise<EntityNote[]>;
  addNote: (entityId: string, content: string, important?: boolean) => Promise<EntityNote | null>;
}

export function useEntityNotes(options: UseEntityNotesOptions): UseEntityNotesResult {
  const [notes, setNotes] = createSignal<EntityNote[]>([]);
  const [newNoteContent, setNewNoteContent] = createSignal('');

  const normalizeNote = (note: EntityNote): EntityNote => ({
    id: note.id,
    content: note.content,
    author: note.authorName || note.author,
    timestamp: note.timestamp,
    important: note.important,
  });

  const loadNotes = async (entityId: string): Promise<EntityNote[]> => {
    const cleanId = entityId.trim();
    if (!cleanId) return [];

    try {
      const response = await fetchNui<EntityNoteResponse>('cad:entityNotes:list', {
        entityType: options.entityType,
        entityId: cleanId,
        limit: 25,
      });

      const loadedNotes = Array.isArray(response.notes)
        ? response.notes.map(normalizeNote)
        : [];

      setNotes(loadedNotes);
      options.onNotesLoaded?.(cleanId, loadedNotes);
      return loadedNotes;
    } catch (error) {
      terminalActions.addLine(`${options.entityType} notes failed: ${String(error)}`, 'error');
      return [];
    }
  };

  const addNote = async (entityId: string, content: string, important = false): Promise<EntityNote | null> => {
    const trimmedContent = content.trim();
    if (!trimmedContent) {
      terminalActions.addLine('Write a note first', 'error');
      return null;
    }

    try {
      const response = await fetchNui<EntityNoteResponse>('cad:entityNotes:add', {
        entityType: options.entityType,
        entityId,
        content: trimmedContent,
        important,
      });

      const note = response.note;
      if (!note) {
        terminalActions.addLine('Failed to save note', 'error');
        return null;
      }

      const normalizedNote = normalizeNote(note);
      setNotes((prev) => [...prev, normalizedNote]);
      setNewNoteContent('');
      options.onNoteAdded?.(entityId, normalizedNote);

      terminalActions.addLine(
        `✓ Note added to ${options.entityType.toLowerCase()} ${entityId}`,
        'output'
      );
      return normalizedNote;
    } catch (error) {
      terminalActions.addLine(`Failed to save note: ${String(error)}`, 'error');
      return null;
    }
  };

  return {
    notes,
    newNoteContent,
    setNewNoteContent,
    loadNotes,
    addNote,
  };
}
