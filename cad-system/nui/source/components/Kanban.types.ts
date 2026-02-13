import type { JSX, Accessor } from 'solid-js';

export interface KanbanColumn {
  id: string;
  title: string;
  color?: string;
  maxItems?: number;
}

export interface KanbanItem {
  id: string;
  columnId: string;
  content: JSX.Element | string;
  priority?: number;
}

export interface KanbanProps {
  columns: KanbanColumn[];
  items: KanbanItem[] | Accessor<KanbanItem[]>;
  columnWidth?: string;
  itemHeight?: string;
  onMove?: (itemId: string, fromColumn: string, toColumn: string, newIndex: number) => void;
  onReorder?: (itemId: string, columnId: string, newIndex: number) => void;
}
