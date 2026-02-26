import { mergeProps, splitProps } from 'solid-js';
import { Button, Input } from '~/components/ui';

interface EntitySearchToolbarProps {
  query: string;
  placeholder: string;
  loading: boolean;
  onQueryChange: (value: string) => void;
  onSearch: () => void;
}

export function EntitySearchToolbar(props: EntitySearchToolbarProps) {
  const merged = mergeProps(
    {
      query: '',
      placeholder: '',
      loading: false,
    },
    props
  );
  const [local] = splitProps(merged, ['query', 'placeholder', 'loading', 'onQueryChange', 'onSearch'] as const);

  return (
    <div class="search-toolbar">
      <Input.Root
        type="text"
        class="dos-input"
        value={local.query}
        onInput={(event) => local.onQueryChange(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            local.onSearch();
          }
        }}
        placeholder={local.placeholder}
      />
      <Button.Root class="btn" onClick={local.onSearch} disabled={local.loading}>
        [SEARCH]
      </Button.Root>
    </div>
  );
}
