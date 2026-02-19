import { JSX, createUniqueId, mergeProps, splitProps } from 'solid-js';
import { cn } from '~/utils/cn';
import { UIField } from './Field';

export interface UITextareaProps extends JSX.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
  containerClass?: string;
  textareaClass?: string;
  labelClass?: string;
  hintClass?: string;
  errorClass?: string;
  bracketedLabel?: boolean;
  uppercaseLabel?: boolean;
}

export interface TextareaRootProps extends JSX.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export function TextareaRoot(props: TextareaRootProps) {
  const [local, textareaProps] = splitProps(props, ['class', 'error']);
  return <textarea {...textareaProps} class={cn('dos-textarea', local.error && 'error', local.class)} />;
}

export function UITextarea(props: UITextareaProps) {
  const generatedId = createUniqueId();
  const merged = mergeProps(
    {
      id: generatedId,
      rows: 4,
    },
    props
  );

  const [local, textareaProps] = splitProps(merged, [
    'label',
    'hint',
    'error',
    'containerClass',
    'textareaClass',
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
      for={textareaProps.id}
      hint={local.hint}
      error={local.error}
      class={local.containerClass}
      labelClass={local.labelClass}
      hintClass={local.hintClass}
      errorClass={local.errorClass}
      bracketedLabel={local.bracketedLabel}
      uppercaseLabel={local.uppercaseLabel}
    >
      <textarea
        {...textareaProps}
        class={cn('dos-textarea', local.error && 'error', local.class, local.textareaClass)}
      />
    </UIField>
  );
}

export const Textarea = Object.assign(TextareaRoot, {
  Root: TextareaRoot,
  Field: UITextarea,
});

export type TextareaComponent = typeof Textarea;
