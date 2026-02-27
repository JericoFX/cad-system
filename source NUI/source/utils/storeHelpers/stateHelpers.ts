/**
 * State Management Helpers
 * 
 * Utility functions to reduce code duplication in store implementations
 */

/**
 * Update an entity in the store with partial data
 * @param setState The store's setState function
 * @param entityKey The key of the entity collection (e.g., 'persons', 'vehicles')
 * @param id The ID of the entity to update
 * @param data Partial data to update the entity with
 */
export function updateEntity<T>(
  setState: Function, 
  entityKey: string, 
  id: string, 
  data: Partial<T>
): void {
  setState(entityKey, id, (prev: T) => ({ 
    ...prev, 
    ...data, 
    ...(entityKey === 'persons' ? { lastUpdated: new Date().toISOString() } : {})
  }));
}

/**
 * Add an item to an array within an entity
 * @param setState The store's setState function
 * @param entityKey The key of the entity collection
 * @param id The ID of the entity
 * @param arrayKey The key of the array to add to
 * @param item The item to add to the array
 */
export function addToArray<T>(
  setState: Function, 
  entityKey: string, 
  id: string, 
  arrayKey: string, 
  item: T
): void {
  setState(entityKey, id, (prev: any) => ({
    ...prev,
    [arrayKey]: [...(prev?.[arrayKey] || []), item],
    ...(entityKey === 'persons' ? { lastUpdated: new Date().toISOString() } : {})
  }));
}

/**
 * Link entities by adding a child entity to a parent's collection
 * @param setState The store's setState function
 * @param parentKey The key of the parent entity collection
 * @param parentId The ID of the parent entity
 * @param childKey The key of the child collection
 * @param childItem The child item to add
 */
export function linkEntities<T>(
  setState: Function,
  parentKey: string,
  parentId: string,
  childKey: string,
  childItem: T
): void {
  setState(parentKey, parentId, childKey, (prev: T[]) => [...(prev || []), childItem]);
}

/**
 * Remove an item from an array within an entity
 * @param setState The store's setState function
 * @param entityKey The key of the entity collection
 * @param id The ID of the entity
 * @param arrayKey The key of the array to remove from
 * @param predicate Function to determine which item(s) to remove
 */
export function removeFromArray<T>(
  setState: Function,
  entityKey: string,
  id: string,
  arrayKey: string,
  predicate: (item: T) => boolean
): void {
  setState(entityKey, id, (prev: any) => ({
    ...prev,
    [arrayKey]: (prev?.[arrayKey] || []).filter((item: T) => !predicate(item)),
    ...(entityKey === 'persons' ? { lastUpdated: new Date().toISOString() } : {})
  }));
}