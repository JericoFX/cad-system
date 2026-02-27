/**
 * Search and Filter Helpers
 * 
 * Utility functions for searching and filtering data
 */

/**
 * Create a search filter function for entities
 * @param fields The fields to search in
 * @returns A function that filters entities based on a query
 */
export function createSearchFilter<T>(fields: (keyof T)[]) {
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

/**
 * Filter items based on a predicate function
 * @param items The items to filter
 * @param predicate Function to determine which items to include
 * @returns Filtered array of items
 */
export function filterItems<T>(items: T[], predicate: (item: T) => boolean): T[] {
  return items.filter(predicate);
}

/**
 * Sort items by a field
 * @param items The items to sort
 * @param field The field to sort by
 * @param direction Sort direction ('asc' or 'desc')
 * @returns Sorted array of items
 */
export function sortItems<T>(items: T[], field: keyof T, direction: 'asc' | 'desc' = 'asc'): T[] {
  return [...items].sort((a, b) => {
    const aVal = a[field];
    const bVal = b[field];
    
    if (aVal < bVal) return direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return direction === 'asc' ? 1 : -1;
    return 0;
  });
}

/**
 * Paginate items
 * @param items The items to paginate
 * @param page The page number (1-based)
 * @param pageSize Number of items per page
 * @returns Paginated array of items
 */
export function paginateItems<T>(items: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}