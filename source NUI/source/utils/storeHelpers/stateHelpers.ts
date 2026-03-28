export function updateEntity<T>(
  setState: (key: string, id: string, updater: (prev: T) => T) => void,
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

export function addToArray<T>(
  setState: (key: string, id: string, updater: (prev: unknown) => unknown) => void,
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

export function linkEntities<T>(
  setState: (key: string, id: string, childKey: string, updater: (prev: T[]) => T[]) => void,
  parentKey: string,
  parentId: string,
  childKey: string,
  childItem: T
): void {
  setState(parentKey, parentId, childKey, (prev: T[]) => [...(prev || []), childItem]);
}

export function removeFromArray<T>(
  setState: (key: string, id: string, updater: (prev: unknown) => unknown) => void,
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
