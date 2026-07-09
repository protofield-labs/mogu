import "server-only";

/** Short TTL in-process cache to cut duplicate Places API billing (#cost P0). */
export const PLACES_RESPONSE_CACHE_TTL_MS = 5 * 60 * 1000;

const PLACES_RESPONSE_CACHE_MAX_ENTRIES = 500;

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const store = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

function pruneExpiredEntries(now: number): void {
  for (const [key, entry] of store) {
    if (entry.expiresAt <= now) {
      store.delete(key);
    }
  }
}

function enforceMaxEntries(): void {
  if (store.size <= PLACES_RESPONSE_CACHE_MAX_ENTRIES) {
    return;
  }
  const overflow = store.size - PLACES_RESPONSE_CACHE_MAX_ENTRIES;
  const keys = store.keys();
  for (let i = 0; i < overflow; i++) {
    const next = keys.next();
    if (next.done) {
      break;
    }
    store.delete(next.value);
  }
}

function shouldCacheValue(value: unknown): boolean {
  return value !== null && value !== undefined;
}

export async function getCachedPlacesResponse<T>(
  key: string,
  loader: () => Promise<T>,
  ttlMs = PLACES_RESPONSE_CACHE_TTL_MS,
): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expiresAt > now) {
    return hit.value as T;
  }

  const pending = inflight.get(key);
  if (pending) {
    return pending as Promise<T>;
  }

  const promise = loader()
    .then((value) => {
      if (shouldCacheValue(value)) {
        store.set(key, { value, expiresAt: Date.now() + ttlMs });
        pruneExpiredEntries(Date.now());
        enforceMaxEntries();
      }
      return value;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);
  return promise as Promise<T>;
}

/** Test-only reset. */
export function resetPlacesResponseCacheForTests(): void {
  store.clear();
  inflight.clear();
}
