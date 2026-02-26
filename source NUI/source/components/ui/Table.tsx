import { For, JSX, Show, splitProps } from 'solid-js';
import { cn } from '~/utils/cn';

export interface UITableColumn<Row> {
  key: string;
  header: JSX.Element | string;
  cell: (row: Row, index: number) => JSX.Element;
  headerClass?: string;
  cellClass?: string;
}

export interface UITableProps<Row> {
  columns: UITableColumn<Row>[];
  rows: Row[];
  class?: string;
  rowClass?: string;
  emptyText?: string;
  getRowKey?: (row: Row, index: number) => string | number;
  selectedKey?: string | number;
  onRowClick?: (row: Row, index: number) => void;
}

export function UITable<Row>(props: UITableProps<Row>) {
  const [local] = splitProps(props, [
    'columns',
    'rows',
    'class',
    'rowClass',
    'emptyText',
    'getRowKey',
    'selectedKey',
    'onRowClick',
  ]);

  return (
    <table class={cn('dos-table', local.class)}>
      <thead>
        <tr>
          <For each={local.columns}>
            {(column) => <th class={cn(column.headerClass)}>{column.header}</th>}
          </For>
        </tr>
      </thead>
      <tbody>
        <Show
          when={local.rows.length > 0}
          fallback={
            <tr>
              <td colSpan={local.columns.length}>
                {local.emptyText || 'No data'}
              </td>
            </tr>
          }
        >
          <For each={local.rows}>
            {(row, index) => {
              const rowIndex = index();
              const rowKey = local.getRowKey?.(row, rowIndex) ?? rowIndex;

              return (
                <tr
                  class={cn(local.rowClass, local.selectedKey === rowKey && 'selected')}
                  onClick={() => local.onRowClick?.(row, rowIndex)}
                >
                  <For each={local.columns}>
                    {(column) => (
                      <td class={cn(column.cellClass)}>{column.cell(row, rowIndex)}</td>
                    )}
                  </For>
                </tr>
              );
            }}
          </For>
        </Show>
      </tbody>
    </table>
  );
}

export const Table = Object.assign(UITable, {
  Root: UITable,
});
