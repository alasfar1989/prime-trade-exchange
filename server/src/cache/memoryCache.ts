interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  cachedAt: string;
}

const store = new Map<string, CacheEntry<unknown>>();
let hits = 0;
let misses = 0;

export function cacheGet<T>(key: string): { data: T; cachedAt: string } | null {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry || Date.now() > entry.expiresAt) {
    if (entry) store.delete(key);
    misses++;
    return null;
  }
  hits++;
  return { data: entry.data, cachedAt: entry.cachedAt };
}

export function cacheSet<T>(key: string, data: T, ttlMs: number): void {
  store.set(key, {
    data,
    expiresAt: Date.now() + ttlMs,
    cachedAt: new Date().toISOString(),
  });
}

export function cacheInvalidate(pattern: string): number {
  let count = 0;
  for (const key of store.keys()) {
    if (key.includes(pattern)) {
      store.delete(key);
      count++;
    }
  }
  return count;
}

export function cacheStats() {
  return { hits, misses, size: store.size };
}
