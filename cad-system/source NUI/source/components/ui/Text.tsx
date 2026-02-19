import { JSX, mergeProps, splitProps } from 'solid-js';
import { cn } from '~/utils/cn';

type TextTone = 'default' | 'dim' | 'bright' | 'system' | 'error' | 'success';
type TextAs = 'span' | 'p' | 'div';

export interface UITextProps extends JSX.HTMLAttributes<HTMLElement> {
  as?: TextAs;
  tone?: TextTone;
  mono?: boolean;
}

function resolveColor(tone: TextTone): string {
  if (tone === 'dim') {
    return 'var(--terminal-fg-dim)';
  }

  if (tone === 'bright') {
    return 'var(--terminal-fg-bright)';
  }

  if (tone === 'system') {
    return 'var(--terminal-system-bright)';
  }

  if (tone === 'error') {
    return 'var(--terminal-error)';
  }

  if (tone === 'success') {
    return 'var(--terminal-success, #00ff00)';
  }

  return 'var(--terminal-fg)';
}

export function UIText(props: UITextProps) {
  const merged = mergeProps(
    {
      as: 'span' as TextAs,
      tone: 'default' as TextTone,
      mono: false,
    },
    props
  );
  const [local, textProps] = splitProps(merged, ['as', 'tone', 'mono', 'class', 'style']);

  const style = () => {
    const base: JSX.CSSProperties = {
      color: resolveColor(local.tone),
      'font-family': local.mono ? 'var(--font-terminal)' : undefined,
    };

    const incomingStyle =
      typeof local.style === 'object' && local.style !== null ? local.style : undefined;

    return {
      ...base,
      ...(incomingStyle || {}),
    };
  };

  if (local.as === 'p') {
    return (
      <p
        {...(textProps as JSX.HTMLAttributes<HTMLParagraphElement>)}
        class={cn(local.class)}
        style={style()}
      />
    );
  }

  if (local.as === 'div') {
    return (
      <div
        {...(textProps as JSX.HTMLAttributes<HTMLDivElement>)}
        class={cn(local.class)}
        style={style()}
      />
    );
  }

  return (
    <span
      {...(textProps as JSX.HTMLAttributes<HTMLSpanElement>)}
      class={cn(local.class)}
      style={style()}
    />
  );
}

export const Text = Object.assign(UIText, {
  Root: UIText,
});

export type TextComponent = typeof Text;
