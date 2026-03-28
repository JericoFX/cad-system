import { JSX, mergeProps, Show, splitProps } from 'solid-js';
import { cn } from '~/utils/cn';
import { useUIContext } from './UIContext';

export type ButtonVariant = 'default' | 'primary' | 'danger' | 'success';
export type ButtonSize = 'default' | 'small';

export interface UIButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  label?: string;
  bracketed?: boolean;
  uppercase?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

function getVariantClass(variant: ButtonVariant, size: ButtonSize): string | undefined {
  if (variant === 'primary') {
    return 'btn-primary';
  }

  if (variant === 'danger') {
    return 'btn-danger';
  }

  if (variant === 'success' && size === 'small') {
    return 'btn-success';
  }

  return undefined;
}

export function UIButton(props: UIButtonProps) {
  const ui = useUIContext();
  const merged = mergeProps(
    {
      type: 'button' as const,
      size: 'default' as ButtonSize,
      variant: 'default' as ButtonVariant,
    },
    props
  );

  const [local, buttonProps] = splitProps(merged, [
    'label',
    'bracketed',
    'uppercase',
    'variant',
    'size',
    'class',
    'children',
  ]);

  const labelOptions = ui.buttonLabelOptions;
  const content = () => {
    if (local.children) {
      return local.children;
    }

    if (!local.label) {
      return '';
    }

    return ui.formatLabel(local.label, {
      bracketed: local.bracketed ?? labelOptions.bracketed,
      uppercase: local.uppercase ?? labelOptions.uppercase,
    });
  };

  return (
    <button
      {...buttonProps}
      class={cn(
        local.size === 'small' ? 'btn-small' : 'btn',
        getVariantClass(local.variant, local.size),
        local.class
      )}
    >
      <Show when={content()}>{content()}</Show>
    </button>
  );
}

export const Button = Object.assign(UIButton, {
  Root: UIButton,
});

export type ButtonComponent = typeof Button;
