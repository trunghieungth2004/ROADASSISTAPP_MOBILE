type Entry = {value: unknown; expiresAt: number};

const store = new Map<string, Entry>();
const pending = new Map<string, Promise<unknown>>();
const generations = new Map<string, number>();

export const CACHE_TTL_MS: Record<string, number> = {
  savedPlaces: 30000,
  savedRoutes: 30000,
  savedRoute: 30000,
  providersMine: 30000,
  providersNear: 15000,
  ticketsMine: 15000,
  billsPayee: 15000,
  ticketsNear: 10000,
  flagsNear: 5000,
  flagsMine: 15000,
};

export function cacheGet<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value as T;
}

export function cacheSet(key: string, value: unknown, ttlMs: number): void {
  if (ttlMs <= 0) return;
  store.set(key, {value, expiresAt: Date.now() + ttlMs});
}

const bumpGeneration = (key: string): void => {
  generations.set(key, (generations.get(key) ?? 0) + 1);
};

export function cacheDel(key: string): void {
  store.delete(key);
  pending.delete(key);
  bumpGeneration(key);
}

export function cacheClear(prefix?: string): void {
  if (!prefix) {
    store.clear();
    for (const key of pending.keys()) bumpGeneration(key);
    pending.clear();
    return;
  }
  for (const key of [...store.keys()]) {
    if (key.startsWith(prefix)) store.delete(key);
  }
  for (const key of [...pending.keys()]) {
    if (key.startsWith(prefix)) {
      pending.delete(key);
      bumpGeneration(key);
    }
  }
}

export function clearApiCache(): void {
  store.clear();
  for (const key of pending.keys()) bumpGeneration(key);
  pending.clear();
}

export async function withCache<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const hit = cacheGet<T>(key);
  if (hit !== null) return hit;
  const ongoing = pending.get(key);
  if (ongoing) return ongoing as Promise<T>;
  const generation = generations.get(key) ?? 0;
  const task = (async (): Promise<T> => {
    const value = await loader();
    if ((generations.get(key) ?? 0) === generation) {
      cacheSet(key, value, ttlMs);
    }
    return value;
  })();
  pending.set(key, task);
  try {
    return await task;
  } finally {
    if (pending.get(key) === task) pending.delete(key);
  }
}
