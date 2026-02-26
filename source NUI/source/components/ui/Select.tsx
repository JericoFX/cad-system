import { For, JSX, Show, createUniqueId, mergeProps, splitProps } from 'solid-js';
import { cn } from '~/utils/cn';
import { UIField } from './Field';

export interface UISelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectRootProps extends JSX.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

export function SelectRoot(props: SelectRootProps) {
  const [local, selectProps] = splitProps(props, ['class', 'error']);
  return <select {...selectProps} class={cn('dos-select', local.error && 'error', local.class)} />;
}

export interface UISelectProps extends JSX.SelectHTMLAttributes<HTMLSelectElement> {
  options: UISelectOption[];
  label?: string;
  hint?: string;
  error?: string;
  placeholder?: string;
  containerClass?: string;
  selectClass?: string;
  labelClass?: string;
  hintClass?: string;
  errorClass?: string;
  bracketedLabel?: boolean;
  uppercaseLabel?: boolean;
}

export function UISelect(props: UISelectProps) {
  const generatedId = createUniqueId();
  const merged = mergeProps(
    {
      id: generatedId,
      placeholder: '',
    },
    props
  );

  const [local, selectProps] = splitProps(merged, [
    'options',
    'label',
    'hint',
    'error',
    'placeholder',
    'containerClass',
    'selectClass',
    'labelClass',
    'hintClass',
    'errorClass',
    'bracketedLabel',
    'uppercaseLabel',
    'class',
  ]);

  return (
    <UIField
      label={local.label}
      for={selectProps.id}
      hint={local.hint}
      error={local.error}
      class={local.containerClass}
      labelClass={local.labelClass}
      hintClass={local.hintClass}
      errorClass={local.errorClass}
      bracketedLabel={local.bracketedLabel}
      uppercaseLabel={local.uppercaseLabel}
    >
      <select
        {...selectProps}
        class={cn('dos-select', local.error && 'error', local.class, local.selectClass)}
      >
        <Show when={local.placeholder}>
          <option value='' disabled>
            {local.placeholder}
          </option>
        </Show>

        <For each={local.options}>
          {(option) => (
            <option value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          )}
        </For>
      </select>
    </UIField>
  );
}

export const Select = Object.assign(SelectRoot, {
  Root: SelectRoot,
  Field: UISelect,
});

export type SelectComponent = typeof Select;
