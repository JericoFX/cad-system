import { Show, mergeProps, splitProps } from 'solid-js';
import type { DispatchUnit } from '~/stores/cadStore';
import { Button } from '~/components/ui';

interface DispatchUnitActionRowProps {
  unit: DispatchUnit;
  subtitle: string;
  actionLabel?: string;
  actionClass?: string;
  actionDisabled?: boolean;
  onAction?: () => void;
}

export function DispatchUnitActionRow(props: DispatchUnitActionRowProps) {
  const merged = mergeProps(
    {
      actionClass: 'btn',
      actionDisabled: false,
      actionLabel: undefined as string | undefined,
      onAction: undefined as (() => void) | undefined,
    },
    props
  );
  const [local] = splitProps(merged, [
    'unit',
    'subtitle',
    'actionLabel',
    'actionClass',
    'actionDisabled',
    'onAction',
  ] as const);

  return (
    <div class="dispatch-v2-unit-row">
      <div>
        <strong>{local.unit.unitId}</strong> {local.unit.name}
        <div class="dispatch-v2-unit-sub">{local.subtitle}</div>
      </div>
      <Show when={local.actionLabel && local.onAction}>
        <Button.Root
          class={local.actionClass}
          onClick={() => local.onAction?.()}
          disabled={local.actionDisabled}
        >
          [{local.actionLabel}]
        </Button.Root>
      </Show>
    </div>
  );
}
