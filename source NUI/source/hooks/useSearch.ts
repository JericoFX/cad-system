import { createSignal } from 'solid-js';
import type { Accessor, Setter } from 'solid-js';
import { fetchNui } from '~/utils/fetchNui';
import { terminalActions } from '~/stores/terminalStore';

interface UseSearchOptions<TResult> {
  endpoint: string;
  resultsKey: string;
  limit?: number;
  onResultsReceived?: (results: TResult[]) => void;
  autoSelect?: (results: TResult[], query: string) => TResult | null;
}

interface UseSearchResult<TResult> {
  query: Accessor<string>;
  setQuery: Setter<string>;
  results: Accessor<TResult[]>;
  loading: Accessor<boolean>;
  selectedItem: Accessor<TResult | null>;
  setSelectedItem: Setter<TResult | null>;
  handleSearch: () => Promise<void>;
  clearResults: () => void;
}

export function useSearch<TResult>(
  options: UseSearchOptions<TResult>
): UseSearchResult<TResult> {
  const [query, setQuery] = createSignal('');
  const [results, setResults] = createSignal<TResult[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [selectedItem, setSelectedItem] = createSignal<TResult | null>(null) as [Accessor<TResult | null>, Setter<TResult | null>];

  const handleSearch = async () => {
    const q = query().trim();
    if (!q) {
      setResults([]);
      setSelectedItem(null);
      return;
    }

    setLoading(true);
    try {
      const response = await fetchNui<Record<string, any>>(options.endpoint, {
        query: q,
        limit: options.limit ?? 15,
      });

      const items = Array.isArray((response as any)?.[options.resultsKey])
        ? (response as any)[options.resultsKey] as TResult[]
        : [];

      options.onResultsReceived?.(items);
      setResults(items);

      if (options.autoSelect) {
        const selected = options.autoSelect(items, q);
        setSelectedItem(selected ?? null);
      } else if (items.length > 0) {
        setSelectedItem(items[0]);
      } else {
        setSelectedItem(null);
      }
    } catch (error) {
      terminalActions.addLine(`Search failed: ${String(error)}`, 'error');
      setResults([]);
      setSelectedItem(null);
    } finally {
      setLoading(false);
    }
  };

  const clearResults = () => {
    setResults([]);
    setSelectedItem(null);
    setQuery('');
  };

  return {
    query,
    setQuery,
    results,
    loading,
    selectedItem,
    setSelectedItem,
    handleSearch,
    clearResults,
  };
}
