import { For, Show } from 'solid-js';
import type { Accessor, JSX } from 'solid-js';
import { formatDate } from '~/utils/storeHelpers/dateHelpers';

export interface NoteItem {
  id: string;
  content: string;
  author: string;
  timestamp: string;
  important?: boolean;
  type?: string;
}

export interface NotesListProps {
  notes: Accessor<NoteItem[]>;
  emptyMessage?: string;
  class?: string;
  noteActions?: (note: NoteItem) => JSX.Element;
}

export function NotesList(props: NotesListProps) {
  const sortedNotes = () =>
    props.notes()
      .slice()
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <div class={props.class || 'entity-notes-list'}>
      <Show
        when={sortedNotes().length > 0}
        fallback={
          <div class="notes-empty-item">
            {props.emptyMessage || 'No notes found'}
          </div>
        }
      >
        <For each={sortedNotes()}>
          {(note) => (
            <div
              class="note-item"
              classList={{ important: !!note.important }}
            >
              <div class="note-header">
                <span class="note-author">{note.author}</span>
                <span class="note-date">{formatDate(note.timestamp)}</span>
              </div>
              <div class="note-preview">{note.content}</div>
              <Show when={props.noteActions}>
                {props.noteActions!(note)}
              </Show>
            </div>
          )}
        </For>
      </Show>
    </div>
  );
}
