/** User-facing copy when Maps JavaScript API fails to render (#185, #225). */
export const MAPS_USER_LOAD_ERROR_MESSAGE =
  "地図を表示できませんでした。しばらくしてから再度お試しください。";

/** Developer-facing detail logged to console.error (#225). */
export const MAPS_DEV_ERROR_DETAIL = {
  missingKey:
    "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not configured.",
  scriptLoad:
    "Maps JavaScript API script failed to load. Check network connectivity.",
  authFailure:
    "Maps auth failed. Verify API key, Billing, and referrer restrictions (http://localhost:3000/* or Cloud Run URL).",
  tilesTimeout:
    "Map tiles did not render in time. Verify Maps JavaScript API is enabled and the API key is valid.",
} as const;

export type MapsLoadFailureKind = keyof typeof MAPS_DEV_ERROR_DETAIL;

export function mapsLoadErrorMessage(_kind: MapsLoadFailureKind): string {
  return MAPS_USER_LOAD_ERROR_MESSAGE;
}

export function logMapsLoadError(kind: MapsLoadFailureKind): void {
  console.error(`[maps] load failed (${kind}):`, MAPS_DEV_ERROR_DETAIL[kind]);
}
