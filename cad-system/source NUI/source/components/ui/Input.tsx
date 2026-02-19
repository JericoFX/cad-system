import { JSX, createUniqueId, mergeProps, splitProps } from 'solid-js';
import { cn } from '~/utils/cn';
import { UIField } from './Field';

export interface UIInputProps extends JSX.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  containerClass?: string;
  inputClass?: string;
  labelClass?: string;
  hintClass?: string;
  errorClass?: string;
  bracketedLabel?: boolean;
  uppercaseLabel?: boolean;
}

export interface InputRootProps extends JSX.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export function InputRoot(props: InputRootProps) {
  const [local, inputProps] = splitProps(props, ['class', 'error']);
  return <input {...inputProps} class={cn('dos-input', local.error && 'error', local.class)} />;
}

export function UIInput(props: UIInputProps) {
  const generatedId = createUniqueId();
  const merged = mergeProps(
    {
      type: 'text',
      id: generatedId,
    },
    props
  );

  const [local, inputProps] = splitProps(merged, [
    'label',
    'hint',
    'error',
    'containerClass',
    'inputClass',
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
      for={inputProps.id}
      hint={local.hint}
      error={local.error}
      class={local.containerClass}
      labelClass={local.labelClass}
      hintClass={local.hintClass}
      errorClass={local.errorClass}
      bracketedLabel={local.bracketedLabel}
      uppercaseLabel={local.uppercaseLabel}
    >
      <input
        {...inputProps}
        class={cn('dos-input', local.error && 'error', local.class, local.inputClass)}
      />
    </UIField>
  );
}

export const Input = Object.assign(InputRoot, {
  Root: InputRoot,
  Field: UIInput,
});

export type InputComponent = typeof Input;
