import { JSX, ParentProps, Show, splitProps } from 'solid-js';
import { cn } from '~/utils/cn';
import { UILabel } from './Label';
import { UIText } from './Text';

export interface UIFieldProps extends ParentProps {
  label?: string;
  for?: string;
  hint?: string;
  error?: string;
  class?: string;
  labelClass?: string;
  contentClass?: string;
  hintClass?: string;
  errorClass?: string;
  style?: JSX.CSSProperties;
  bracketedLabel?: boolean;
  uppercaseLabel?: boolean;
}

export function UIField(props: UIFieldProps) {
  const [local] = splitProps(props, [
    'label',
    'for',
    'hint',
    'error',
    'class',
    'labelClass',
    'contentClass',
    'hintClass',
    'errorClass',
    'style',
    'children',
    'bracketedLabel',
    'uppercaseLabel',
  ]);

  return (
    <div class={cn('form-section', local.class)} style={local.style}>
      <Show when={local.label}>
        <UILabel
          for={local.for}
          text={local.label}
          class={local.labelClass}
          bracketed={local.bracketedLabel}
          uppercase={local.uppercaseLabel}
        />
      </Show>

      <div class={cn(local.contentClass)}>{local.children}</div>

      <Show when={local.hint && !local.error}>
        <UIText as='div' tone='dim' class={cn(local.hintClass)} style={{ 'font-size': '12px', 'margin-top': '6px' }}>
          {local.hint}
        </UIText>
      </Show>

      <Show when={local.error}>
        <UIText
          as='div'
          tone='error'
          class={cn(local.errorClass)}
          style={{ 'font-size': '12px', 'margin-top': '6px', 'font-weight': 'bold' }}
        >
          {local.error}
        </UIText>
      </Show>
    </div>
  );
}
