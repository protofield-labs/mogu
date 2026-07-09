/**
 * Places dedup + short TTL cache verification (#cost P0).
 * Run via: pnpm exec tsx scripts/verify-places-cache.ts
 */
import { assert } from "./test-helpers/assert";

import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd(), "src");

function readSource(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

function main() {
  const cacheModule = readSource("lib/places/places-response-cache.ts");
  assert(
    cacheModule.includes("getCachedPlacesResponse"),
    "places response cache helper exists",
  );
  assert(
    cacheModule.includes("PLACES_RESPONSE_CACHE_TTL_MS = 5 * 60 * 1000"),
    "default TTL is 5 minutes",
  );
  assert(
    cacheModule.includes("PLACES_RESPONSE_CACHE_MAX_ENTRIES"),
    "server cache caps entry count",
  );
  assert(cacheModule.includes("inflight"), "server cache coalesces in-flight loads");

  const googleClient = readSource("lib/places/google-places-client.ts");
  assert(
    googleClient.includes("getCachedPlacesResponse"),
    "google places client uses response cache",
  );
  assert(
    googleClient.includes("fetchPlaceDetailsUncached"),
    "place details has uncached loader",
  );
  assert(
    googleClient.includes("fetchPlaceLocationUncached"),
    "place locations has uncached loader",
  );
  assert(
    !googleClient.includes("no server-side cache"),
    "removed stale no-cache comment",
  );

  const usePlace = readSource("lib/places/use-place.ts");
  assert(usePlace.includes("fetchPlaceDeduped"), "usePlace uses client dedup");

  const usePlaceNames = readSource("lib/places/use-place-names.ts");
  assert(
    usePlaceNames.includes("fetchPlaceDeduped"),
    "usePlaceNames uses client dedup",
  );

  const clientCache = readSource("lib/places/place-client-cache.ts");
  assert(clientCache.includes("inflight"), "client cache dedups in-flight requests");
  assert(
    clientCache.includes("if (value !== null)"),
    "client cache skips null failures",
  );

  console.log("PASS: places dedup + cache verified");
}

main();
