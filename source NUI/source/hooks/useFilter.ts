import { createSignal, createMemo } from 'solid-js';
import type { Accessor, Setter } from 'solid-js';

interface FilterConfig<T> {
  key: string;
  accessor: (item: T) => string | number | undefined;
  defaultValue?: string;
}

interface UseFilterOptions<T> {
  source: Accessor<T[]>;
  filters: FilterConfig<T>[];
  searchFields?: ((item: T) => string | undefined)[];
  sort?: (a: T, b: T) => number;
}

interface UseFilterResult<T> {
  filtered: Accessor<T[]>;
  searchQuery: Accessor<string>;
  setSearchQuery: Setter<string>;
  filterValues: Record<string, [Accessor<string>, Setter<string>]>;
  resetFilters: () => void;
}

export function useFilter<T>(options: UseFilterOptions<T>): UseFilterResult<T> {
  const [searchQuery, setSearchQuery] = createSignal('');

  const filterSignals: Record<string, [Accessor<string>, Setter<string>]> = {};
  for (const filter of options.filters) {
    const [value, setValue] = createSignal(filter.defaultValue ?? 'all');
    filterSignals[filter.key] = [value, setValue];
  }

  const filtered = createMemo(() => {
    let items = options.source();

    const query = searchQuery().toLowerCase();
    if (query && options.searchFields) {
      items = items.filter((item) =>
        options.searchFields!.some((field) => {
          const value = field(item);
          return typeof value === 'string' && value.toLowerCase().includes(query);
        })
      );
    }

    for (const filter of options.filters) {
      const [value] = filterSignals[filter.key];
      if (value() !== 'all') {
        items = items.filter((item) => {
          const itemValue = filter.accessor(item);
          return String(itemValue) === value();
        });
      }
    }

    if (options.sort) {
      items = [...items].sort(options.sort);
    }

    return items;
  });

  const resetFilters = () => {
    setSearchQuery('');
    for (const filter of options.filters) {
      const [, setValue] = filterSignals[filter.key];
      setValue(filter.defaultValue ?? 'all');
    }
  };

  return {
    filtered,
    searchQuery,
    setSearchQuery,
    filterValues: filterSignals,
    resetFilters,
  };
}
