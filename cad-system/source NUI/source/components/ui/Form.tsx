import { JSX, ParentProps } from 'solid-js';
import { cn } from '~/utils/cn';
import { UIField } from './Field';
import { UILabel } from './Label';
import { UIInput } from './Input';
import { UISelect } from './Select';
import { UITextarea } from './Textarea';

export interface FormRootProps extends ParentProps {
  class?: string;
  style?: JSX.CSSProperties;
}

export function FormRoot(props: FormRootProps) {
  return (
    <div class={cn('dos-form', props.class)} style={props.style}>
      {props.children}
    </div>
  );
}

export const Form = Object.assign(FormRoot, {
  Root: FormRoot,
  Field: UIField,
  Label: UILabel,
  Input: UIInput,
  Select: UISelect,
  Textarea: UITextarea,
});

export type FormComponent = typeof Form;
