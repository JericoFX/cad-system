import { Component, createSignal, For, createMemo } from 'solid-js';
import type { KanbanProps, KanbanItem } from './Kanban.types';

export const Kanban: Component<KanbanProps> = (props) => {
  const [draggingItem, setDraggingItem] = createSignal<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = createSignal<string | null>(null);
  const [dragOverItem, setDragOverItem] = createSignal<string | null>(null);

  const items = createMemo(() => {
    const itemsProp = props.items;
    return typeof itemsProp === 'function' ? itemsProp() : itemsProp;
  });

  const getItemsForColumn = (columnId: string): KanbanItem[] => {
    return items()
      .filter(item => item.columnId === columnId)
      .sort((a, b) => (a.priority || 0) - (b.priority || 0));
  };

  const handleDragStart = (e: DragEvent, itemId: string) => {
    setDraggingItem(itemId);
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', itemId);
    }
  };

  const handleDragOverColumn = (e: DragEvent, columnId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverColumn(columnId);
  };

  const handleDragOverItem = (e: DragEvent, itemId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverItem(itemId);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
    setDragOverItem(null);
  };

  const handleDropOnColumn = (e: DragEvent, targetColumnId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    const itemId = e.dataTransfer?.getData('text/plain');
    if (!itemId) return;

    const item = items().find((i: KanbanItem) => i.id === itemId);
    if (!item) return;

    if (item.columnId !== targetColumnId) {
      const targetItems = getItemsForColumn(targetColumnId);
      props.onMove?.(itemId, item.columnId, targetColumnId, targetItems.length);
    }

    setDraggingItem(null);
    setDragOverColumn(null);
    setDragOverItem(null);
  };

  const handleDropOnItem = (e: DragEvent, targetItemId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    const draggedId = e.dataTransfer?.getData('text/plain');
    if (!draggedId || draggedId === targetItemId) return;

    const draggedItem = items().find((i: KanbanItem) => i.id === draggedId);
    const targetItem = items().find((i: KanbanItem) => i.id === targetItemId);
    
    if (!draggedItem || !targetItem) return;

    if (draggedItem.columnId === targetItem.columnId) {
      const columnItems = getItemsForColumn(draggedItem.columnId);
      const newIndex = columnItems.findIndex(i => i.id === targetItemId);
      props.onReorder?.(draggedId, draggedItem.columnId, newIndex);
    } else {
      const targetItems = getItemsForColumn(targetItem.columnId);
      const newIndex = targetItems.findIndex(i => i.id === targetItemId);
      props.onMove?.(draggedId, draggedItem.columnId, targetItem.columnId, newIndex);
    }

    setDraggingItem(null);
    setDragOverColumn(null);
    setDragOverItem(null);
  };

  const columnWidth = () => props.columnWidth || '280px';
  const itemHeight = () => props.itemHeight || 'auto';

  return (
    <div class="dos-kanban">
      <For each={props.columns}>
        {(column) => {
          const columnItems = () => getItemsForColumn(column.id);
          const itemCount = () => columnItems().length;
          const isFull = () => column.maxItems !== undefined && itemCount() >= column.maxItems;

          return (
            <div
              class={`dos-kanban-column ${
                dragOverColumn() === column.id ? 'dos-kanban-column-dragover' : ''
              } ${isFull() ? 'dos-kanban-column-full' : ''}`}
              style={{ width: columnWidth() }}
              onDragOver={(e) => handleDragOverColumn(e, column.id)}
              onDrop={(e) => handleDropOnColumn(e, column.id)}
              onDragLeave={handleDragLeave}
            >
              <div class={`dos-kanban-header ${column.color || ''}`}>
                <span class="dos-kanban-title">{column.title}</span>
                <span class="dos-kanban-count">
                  [{itemCount()}{column.maxItems ? `/${column.maxItems}` : ''}]
                </span>
              </div>

              <div class="dos-kanban-items">
                <For each={columnItems()}>
                  {(item) => (
                    <div
                      class={`dos-kanban-item ${
                        draggingItem() === item.id ? 'dos-kanban-item-dragging' : ''
                      } ${dragOverItem() === item.id ? 'dos-kanban-item-dragover' : ''}`}
                      style={{ height: itemHeight() }}
                      draggable={true}
                      onDragStart={(e) => handleDragStart(e, item.id)}
                      onDragOver={(e) => handleDragOverItem(e, item.id)}
                      onDrop={(e) => handleDropOnItem(e, item.id)}
                      onDragLeave={handleDragLeave}
                    >
                      <div class="dos-kanban-item-content">
                        {typeof item.content === 'string' ? (
                          <span>{item.content}</span>
                        ) : (
                          item.content
                        )}
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </div>
          );
        }}
      </For>
    </div>
  );
};

export default Kanban;
