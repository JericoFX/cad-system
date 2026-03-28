export function createSearchFilter<T>(fields: (keyof T)[]): (items: T[], query: string) => T[] {
  return (items: T[], query: string): T[] => {
    if (!query || query.trim() === '') {
      return items;
    }

    const lowerQuery = query.toLowerCase().trim();
    return items.filter(item =>
      fields.some(field => {
        const value = item[field];
        return typeof value === 'string' && value.toLowerCase().includes(lowerQuery);
      })
    );
  };
}

export function filterItems<T>(items: T[], predicate: (item: T) => boolean): T[] {
  return items.filter(predicate);
}

export function sortItems<T>(items: T[], field: keyof T, direction: 'asc' | 'desc' = 'asc'): T[] {
  return [...items].sort((a, b) => {
    const aVal = a[field];
    const bVal = b[field];

    if (aVal < bVal) return direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return direction === 'asc' ? 1 : -1;
    return 0;
  });
}

export function paginateItems<T>(items: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}
