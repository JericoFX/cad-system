import { mergeProps, splitProps } from 'solid-js';
import { Button, Textarea } from '~/components/ui';

interface EntityNoteEditorProps {
  content: string;
  important: boolean;
  placeholder: string;
  saveLabel: string;
  onContentChange: (value: string) => void;
  onToggleImportant: () => void;
  onSave: () => void;
}

export function EntityNoteEditor(props: EntityNoteEditorProps) {
  const merged = mergeProps(
    {
      content: '',
      important: false,
      placeholder: '',
      saveLabel: 'SAVE',
    },
    props
  );
  const [local] = splitProps(merged, [
    'content',
    'important',
    'placeholder',
    'saveLabel',
    'onContentChange',
    'onToggleImportant',
    'onSave',
  ] as const);

  return (
    <div style={{ 'margin-top': '10px' }}>
      <Textarea.Root
        class="dos-textarea"
        rows={3}
        value={local.content}
        onInput={(event) => local.onContentChange(event.currentTarget.value)}
        placeholder={local.placeholder}
      />
      <div
        style={{
          display: 'flex',
          gap: '8px',
          'margin-top': '6px',
          'align-items': 'center',
        }}
      >
        <Button.Root class="btn" onClick={local.onToggleImportant}>
          [{local.important ? 'X' : ' '}] IMPORTANT
        </Button.Root>
        <Button.Root class="btn btn-primary" onClick={local.onSave}>
          [{local.saveLabel}]
        </Button.Root>
      </div>
    </div>
  );
}
