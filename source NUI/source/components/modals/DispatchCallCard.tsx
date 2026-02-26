import { mergeProps, splitProps } from 'solid-js';
import type { DispatchCall } from '~/stores/cadStore';

interface DispatchCallCardProps {
  call: DispatchCall;
  selected: boolean;
  onSelect: (callId: string) => void;
  getSlaLevel: (call: DispatchCall) => string;
  getSlaLabel: (call: DispatchCall) => string;
  formatAge: (iso: string) => string;
  priorityLabel: (priority: number) => string;
}

export function DispatchCallCard(props: DispatchCallCardProps) {
  const merged = mergeProps(
    {
      selected: false,
    },
    props
  );
  const [local] = splitProps(merged, [
    'call',
    'selected',
    'onSelect',
    'getSlaLevel',
    'getSlaLabel',
    'formatAge',
    'priorityLabel',
  ] as const);

  const slaLevel = () => local.getSlaLevel(local.call);
  const priority = () => local.priorityLabel(local.call.priority);

  return (
    <button
      class={`dispatch-v2-call-card sla-${slaLevel()} ${local.selected ? 'is-selected' : ''}`}
      onClick={() => local.onSelect(local.call.callId)}
    >
      <div class="dispatch-v2-call-card-header">
        <div style={{ display: 'flex', 'align-items': 'center', gap: '6px' }}>
          <span class={`dispatch-v2-priority priority-${priority().toLowerCase()}`}>{priority()}</span>
          <span class={`dispatch-v2-sla-badge sla-${slaLevel()}`}>{local.getSlaLabel(local.call)}</span>
        </div>
        <span class="dispatch-v2-call-id">{local.call.callId}</span>
      </div>
      <div class="dispatch-v2-call-title">{local.call.title}</div>
      <div class="dispatch-v2-call-meta">
        <span>{local.call.type}</span>
        <span>{local.call.location || 'No location'}</span>
      </div>
      <div class="dispatch-v2-call-meta">
        <span>{local.call.status}</span>
        <span>{Object.keys(local.call.assignedUnits).length} units</span>
        <span>{local.formatAge(local.call.createdAt)}</span>
      </div>
    </button>
  );
}
