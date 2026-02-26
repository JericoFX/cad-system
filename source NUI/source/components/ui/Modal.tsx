import { createContext, JSX, ParentProps, Show, splitProps, useContext } from 'solid-js';
import { cn } from '~/utils/cn';
import { useUIContext } from './UIContext';

interface ModalContextValue {
  onClose?: () => void;
}

const ModalContext = createContext<ModalContextValue>({});

function useModalContext() {
  return useContext(ModalContext);
}

export interface ModalRootProps extends ParentProps {
  onClose?: () => void;
  closeOnOverlay?: boolean;
  useContentWrapper?: boolean;
  overlayClass?: string;
  contentClass?: string;
  overlayStyle?: JSX.CSSProperties;
  contentStyle?: JSX.CSSProperties;
  overlayAttributes?: Omit<JSX.HTMLAttributes<HTMLDivElement>, 'class' | 'style' | 'onClick'>;
}

export type ModalProps = ModalRootProps;

export function ModalRoot(props: ModalRootProps) {
  const [local] = splitProps(props, [
    'onClose',
    'closeOnOverlay',
    'useContentWrapper',
    'overlayClass',
    'contentClass',
    'overlayStyle',
    'contentStyle',
    'overlayAttributes',
    'children',
  ]);

  const contextValue: ModalContextValue = {
    onClose: local.onClose,
  };

  return (
    <ModalContext.Provider value={contextValue}>
      <div
        {...local.overlayAttributes}
        class={cn('modal-overlay', local.overlayClass)}
        style={local.overlayStyle}
        onClick={() => {
          if (local.closeOnOverlay !== false) {
            local.onClose?.();
          }
        }}
      >
        <Show
          when={local.useContentWrapper !== false}
          fallback={local.children}
        >
          <div
            class={cn('modal-content', local.contentClass)}
            style={local.contentStyle}
            onClick={(event) => event.stopPropagation()}
          >
            {local.children}
          </div>
        </Show>
      </div>
    </ModalContext.Provider>
  );
}

export interface ModalHeaderProps extends ParentProps {
  class?: string;
  style?: JSX.CSSProperties;
}

export function ModalHeader(props: ModalHeaderProps) {
  return (
    <div class={cn('modal-header', props.class)} style={props.style}>
      {props.children}
    </div>
  );
}

export interface ModalTitleProps extends JSX.HTMLAttributes<HTMLHeadingElement> {
  as?: 'h1' | 'h2' | 'h3';
}

export function ModalTitle(props: ModalTitleProps) {
  const [local, titleProps] = splitProps(props, ['as', 'children', 'class']);
  const tag = () => local.as || 'h2';

  if (tag() === 'h1') {
    return (
      <h1 {...(titleProps as JSX.HTMLAttributes<HTMLHeadingElement>)} class={cn(local.class)}>
        {local.children}
      </h1>
    );
  }

  if (tag() === 'h3') {
    return (
      <h3 {...(titleProps as JSX.HTMLAttributes<HTMLHeadingElement>)} class={cn(local.class)}>
        {local.children}
      </h3>
    );
  }

  return (
    <h2 {...(titleProps as JSX.HTMLAttributes<HTMLHeadingElement>)} class={cn(local.class)}>
      {local.children}
    </h2>
  );
}

export function ModalBody(props: ParentProps<{ class?: string; style?: JSX.CSSProperties }>) {
  return (
    <div class={cn(props.class)} style={props.style}>
      {props.children}
    </div>
  );
}

export function ModalFooter(props: ParentProps<{ class?: string; style?: JSX.CSSProperties }>) {
  return (
    <div class={cn('modal-footer', props.class)} style={props.style}>
      {props.children}
    </div>
  );
}

export interface ModalCloseProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  label?: string;
  useHeaderClass?: boolean;
}

export function ModalClose(props: ModalCloseProps) {
  const ui = useUIContext();
  const context = useModalContext();
  const [local, buttonProps] = splitProps(props, [
    'label',
    'class',
    'children',
    'useHeaderClass',
  ]);

  const content = () => {
    if (local.children) {
      return local.children;
    }

    const raw = local.label || 'X';
    return ui.formatLabel(raw, ui.buttonLabelOptions);
  };

  return (
    <button
      type='button'
      {...buttonProps}
      class={cn(local.useHeaderClass === false ? 'btn' : 'modal-close', local.class)}
      onClick={() => context.onClose?.()}
    >
      <Show when={content()}>{content()}</Show>
    </button>
  );
}

export interface ModalDescriptionProps extends JSX.HTMLAttributes<HTMLDivElement> {}

export function ModalDescription(props: ModalDescriptionProps) {
  return <div {...props} class={cn(props.class)}>{props.children}</div>;
}

export const Modal = Object.assign(ModalRoot, {
  Root: ModalRoot,
  Header: ModalHeader,
  Title: ModalTitle,
  Description: ModalDescription,
  Body: ModalBody,
  Footer: ModalFooter,
  Close: ModalClose,
});

export type ModalComponent = typeof Modal;
