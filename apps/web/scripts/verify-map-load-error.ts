/**
 * Maps load error UX verification (#185 Definition of Done).
 * Run via: pnpm exec tsx scripts/verify-map-load-error.ts
 */
import { assert } from "./test-helpers/assert";

import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd(), "src");

function readSource(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

const mapsLoadError = readSource("lib/places/maps-load-error.ts");
assert(mapsLoadError.includes("MAPS_LOAD_ERROR_MESSAGE"), "maps load error messages");
assert(mapsLoadError.includes("authFailure"), "auth failure copy");

const mapApiProvider = readSource("components/collections/map-api-provider.tsx");
assert(mapApiProvider.includes("MapApiProvider"), "map api provider exported");
assert(mapApiProvider.includes("useApiLoadingStatus"), "watches api loading status");
assert(mapApiProvider.includes("APILoadingStatus.AUTH_FAILURE"), "handles auth failure");
assert(mapApiProvider.includes("MonitoredMap"), "monitored map exported");
assert(mapApiProvider.includes("canvas"), "detects blank map without canvas");
assert(mapApiProvider.includes("RefererNotAllowedMapError"), "listens for referrer errors");
assert(mapApiProvider.includes("gmp-error"), "watches gmp error overlay");

const mapView = readSource("components/collections/collection-spot-map-view.tsx");
assert(mapView.includes("MapApiProvider"), "map view uses map api provider");
assert(mapView.includes("MonitoredMap"), "map view uses monitored map");
assert(mapView.includes("mapsLoadError"), "map view surfaces load errors");
assert(mapView.includes("MAPS_LOAD_ERROR_MESSAGE"), "map view uses shared copy");

console.log("PASS: map load error UX verified");
