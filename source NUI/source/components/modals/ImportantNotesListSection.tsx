import { For, Show, mergeProps, splitProps } from 'solid-js';

type ImportantNoteItem = {
  important: boolean;
  content: string;
  timestamp: string;
};

interface ImportantNotesListSectionProps {
  title: string;
  notes: ImportantNoteItem[];
  loading: boolean;
  emptyMessage: string;
}

export function ImportantNotesListSection(props: ImportantNotesListSectionProps) {
  const merged = mergeProps(
    {
      notes: [] as ImportantNoteItem[],
      loading: false,
      emptyMessage: 'No notes found.',
    },
    props
  );
  const [local] = splitProps(merged, ['title', 'notes', 'loading', 'emptyMessage'] as const);

  return (
    <div class="dispatch-section">
      <h3>{local.title}</h3>
      <Show when={!local.loading} fallback={<div class="dispatch-empty">Loading...</div>}>
        <For each={local.notes}>
          {(note) => (
            <div class="dispatch-item">
              <div class="dispatch-item-header">
                <span class="dispatch-item-title">{note.important ? 'IMPORTANT' : 'NOTE'}</span>
                <span>{new Date(note.timestamp).toLocaleString()}</span>
              </div>
              <div class="dispatch-item-meta">{note.content}</div>
            </div>
          )}
        </For>
        <Show when={local.notes.length === 0}>
          <div class="dispatch-empty">{local.emptyMessage}</div>
        </Show>
      </Show>
    </div>
  );
}
