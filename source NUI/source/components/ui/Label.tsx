import { JSX, mergeProps, splitProps } from 'solid-js';
import { cn } from '~/utils/cn';
import { useUIContext } from './UIContext';

export interface UILabelProps extends JSX.LabelHTMLAttributes<HTMLLabelElement> {
  text?: string;
  bracketed?: boolean;
  uppercase?: boolean;
}

export function UILabel(props: UILabelProps) {
  const ui = useUIContext();
  const merged = mergeProps(
    {
      bracketed: ui.fieldLabelOptions.bracketed,
      uppercase: ui.fieldLabelOptions.uppercase,
    },
    props
  );

  const [local, labelProps] = splitProps(merged, [
    'text',
    'class',
    'children',
    'bracketed',
    'uppercase',
  ]);

  const content = () => {
    if (local.children) {
      return local.children;
    }

    if (!local.text) {
      return '';
    }

    return ui.formatLabel(local.text, {
      bracketed: local.bracketed,
      uppercase: local.uppercase,
    });
  };

  return (
    <label {...labelProps} class={cn('form-label', local.class)}>
      {content()}
    </label>
  );
}
