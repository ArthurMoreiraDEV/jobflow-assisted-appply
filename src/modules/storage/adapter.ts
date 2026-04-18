export interface StorageAdapter {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
}

export function createMemoryStorageAdapter(
  initial: Record<string, unknown> = {},
): StorageAdapter {
  const store = new Map<string, unknown>(Object.entries(initial));
  return {
    async get<T>(key: string): Promise<T | undefined> {
      return store.has(key) ? (store.get(key) as T) : undefined;
    },
    async set<T>(key: string, value: T): Promise<void> {
      store.set(key, value);
    },
    async remove(key: string): Promise<void> {
      store.delete(key);
    },
    async clear(): Promise<void> {
      store.clear();
    },
  };
}

interface ChromeLike {
  storage?: {
    local?: {
      get: (keys: string | string[] | null) => Promise<Record<string, unknown>>;
      set: (items: Record<string, unknown>) => Promise<void>;
      remove: (keys: string | string[]) => Promise<void>;
      clear: () => Promise<void>;
    };
  };
}

export function createChromeStorageAdapter(api: ChromeLike['storage']): StorageAdapter {
  if (!api?.local) {
    throw new Error('chrome.storage.local is not available');
  }
  const local = api.local;
  return {
    async get<T>(key: string): Promise<T | undefined> {
      const result = await local.get(key);
      return result[key] as T | undefined;
    },
    async set<T>(key: string, value: T): Promise<void> {
      await local.set({ [key]: value });
    },
    async remove(key: string): Promise<void> {
      await local.remove(key);
    },
    async clear(): Promise<void> {
      await local.clear();
    },
  };
}

let defaultAdapter: StorageAdapter | undefined;

export function getStorageAdapter(): StorageAdapter {
  if (defaultAdapter) return defaultAdapter;
  const globalChrome = (globalThis as unknown as { chrome?: ChromeLike }).chrome;
  if (globalChrome?.storage?.local) {
    defaultAdapter = createChromeStorageAdapter(globalChrome.storage);
  } else {
    defaultAdapter = createMemoryStorageAdapter();
  }
  return defaultAdapter;
}

export function setStorageAdapter(adapter: StorageAdapter | undefined): void {
  defaultAdapter = adapter;
}
