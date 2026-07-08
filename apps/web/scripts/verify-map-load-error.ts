/**
 * Maps load error UX verification (#185, #225).
 * Run via: pnpm exec tsx scripts/verify-map-load-error.ts
 */
import { assert } from "./test-helpers/assert";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  logMapsLoadError,
  MAPS_USER_LOAD_ERROR_MESSAGE,
  mapsLoadErrorMessage,
} from "../src/lib/places/maps-load-error";

const root = join(process.cwd(), "src");

function readSource(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

const mapsLoadError = readSource("lib/places/maps-load-error.ts");
assert(
  mapsLoadError.includes("MAPS_USER_LOAD_ERROR_MESSAGE"),
  "maps user-facing error message",
);
assert(
  mapsLoadError.includes("MAPS_DEV_ERROR_DETAIL"),
  "maps developer error detail for console",
);
assert(
  mapsLoadError.includes("logMapsLoadError"),
  "maps load errors are logged to console",
);
assert(
  !MAPS_USER_LOAD_ERROR_MESSAGE.includes("API キー"),
  "user message avoids developer jargon",
);
assert(
  mapsLoadErrorMessage("authFailure") === MAPS_USER_LOAD_ERROR_MESSAGE,
  "all failure kinds share user-facing copy",
);

const mapApiProvider = readSource("components/collections/map-api-provider.tsx");
assert(mapApiProvider.includes("MapApiProvider"), "map api provider exported");
assert(mapApiProvider.includes("useApiLoadingStatus"), "watches api loading status");
assert(mapApiProvider.includes("APILoadingStatus.AUTH_FAILURE"), "handles auth failure");
assert(mapApiProvider.includes("MonitoredMap"), "monitored map exported");
assert(mapApiProvider.includes("hasRenderedMapTiles"), "detects raster img tiles");
assert(mapApiProvider.includes("maps.googleapis.com/maps/vt"), "detects raster tile img src");
assert(mapApiProvider.includes("tilesloaded"), "listens for tilesloaded event");
assert(mapApiProvider.includes("RefererNotAllowedMapError"), "listens for referrer errors");
assert(mapApiProvider.includes("gmp-error"), "watches gmp error overlay");
assert(mapApiProvider.includes("logMapsLoadError"), "provider logs technical detail");

const mapView = readSource("components/collections/collection-spot-map-view.tsx");
assert(mapView.includes("MapApiProvider"), "map view uses map api provider");
assert(mapView.includes("MonitoredMap"), "map view uses monitored map");
assert(mapView.includes("mapsLoadError"), "map view surfaces load errors");
assert(mapView.includes("MAPS_USER_LOAD_ERROR_MESSAGE"), "map view uses user-facing copy");
assert(mapView.includes("handleRetryMap"), "map view offers retry");
assert(mapView.includes("showFallbackList"), "map view shows spot list when map fails");
assert(mapView.includes("selectedMarker ?"), "spot card stays available when map fails");
assert(mapView.includes("mapRetryKey"), "map view remounts provider on retry");

const mypageMapView = readSource("components/mypage/mypage-all-spots-map-view.tsx");
assert(mapView.includes("missingKeyLoggedRef"), "missing key logging runs once in effect");
assert(
  mypageMapView.includes("onMapsLoadErrorChange"),
  "mypage map hides pin count when map fails",
);
assert(
  mypageMapView.includes("mapsLoadFailed"),
  "mypage map tracks map load failure",
);

// Smoke: logMapsLoadError should not throw (console is mocked in node).
const originalError = console.error;
console.error = () => {};
logMapsLoadError("tilesTimeout");
console.error = originalError;

console.log("PASS: map load error UX verified");
