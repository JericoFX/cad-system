import type { JSX } from 'solid-js';

const PRIORITY_NUMERIC_COLORS: Record<number, string> = {
  1: '#ff0000',
  2: '#ff8800',
  3: '#ffff00',
  4: '#00ff00',
  5: '#808080',
};

const PRIORITY_TEXT_COLORS: Record<string, string> = {
  HIGH: '#ff0000',
  MEDIUM: '#ff8800',
  LOW: '#ffff00',
  CRITICAL: '#ff0000',
  SERIOUS: '#ffaa00',
  STABLE: '#00ff00',
};

const STATUS_COLORS: Record<string, string> = {
  available: '#00ff00',
  green: '#00ff00',
  in_use: '#0088ff',
  blue: '#0088ff',
  maintenance: '#ff8800',
  orange: '#ff8800',
  retired: '#ff0000',
  red: '#ff0000',
  open: '#00ff00',
  closed: '#808080',
  active: '#00ff00',
  revoked: '#ff0000',
};

export interface StatusBadgeProps {
  value: string | number;
  label?: string;
  variant?: 'priority-numeric' | 'priority-text' | 'status' | 'custom';
  color?: string;
  class?: string;
  style?: JSX.CSSProperties;
}

export function StatusBadge(props: StatusBadgeProps) {
  const resolvedColor = (): string => {
    if (props.color) return props.color;

    const variant = props.variant || 'status';

    if (variant === 'priority-numeric') {
      return PRIORITY_NUMERIC_COLORS[Number(props.value)] || '#808080';
    }

    if (variant === 'priority-text') {
      return PRIORITY_TEXT_COLORS[String(props.value).toUpperCase()] || '#808080';
    }

    if (variant === 'status') {
      return STATUS_COLORS[String(props.value).toLowerCase()] || '#808080';
    }

    return '#808080';
  };

  const displayLabel = () => props.label ?? String(props.value);

  return (
    <span
      class={props.class || 'status-badge'}
      style={{
        color: resolvedColor(),
        'border-color': resolvedColor(),
        ...props.style,
      }}
    >
      {displayLabel()}
    </span>
  );
}

export function getPriorityColor(priority: string | number): string {
  if (typeof priority === 'number') {
    return PRIORITY_NUMERIC_COLORS[priority] || '#808080';
  }
  return PRIORITY_TEXT_COLORS[String(priority).toUpperCase()] || '#808080';
}

export function getStatusColor(status: string): string {
  return STATUS_COLORS[String(status).toLowerCase()] || '#808080';
}
