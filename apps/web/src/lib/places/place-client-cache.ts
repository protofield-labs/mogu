"use client";

import { fetchPlace } from "@/lib/agent/browser-api";
import type { PlaceDTO } from "@/lib/agent/types";

/** Match server TTL so client dedup aligns with API cache window. */
export const PLACE_CLIENT_CACHE_TTL_MS = 5 * 60 * 1000;

type PlaceCacheEntry = {
  value: PlaceDTO | null;
  expiresAt: number;
};

const cache = new Map<string, PlaceCacheEntry>();
const inflight = new Map<string, Promise<PlaceDTO | null>>();

/** Dedup concurrent and repeat fetches for the same placeId (#cost P0). */
export function fetchPlaceDeduped(placeId: string): Promise<PlaceDTO | null> {
  const normalized = placeId.trim();
  if (!normalized) {
    return Promise.resolve(null);
  }

  const now = Date.now();
  const hit = cache.get(normalized);
  if (hit && hit.expiresAt > now) {
    return Promise.resolve(hit.value);
  }

  const pending = inflight.get(normalized);
  if (pending) {
    return pending;
  }

  const promise = fetchPlace(normalized)
    .then((value) => {
      if (value !== null) {
        cache.set(normalized, {
          value,
          expiresAt: Date.now() + PLACE_CLIENT_CACHE_TTL_MS,
        });
      }
      return value;
    })
    .finally(() => {
      inflight.delete(normalized);
    });

  inflight.set(normalized, promise);
  return promise;
}

/** Test-only reset. */
export function resetPlaceClientCacheForTests(): void {
  cache.clear();
  inflight.clear();
}
