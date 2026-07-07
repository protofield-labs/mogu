/** Server-side proxy path for Place Photos (guardrail 7 — no persistence). */
export function buildPlacePhotoProxyUrl(placeId: string, index: number): string {
  return `/api/v1/places/${encodeURIComponent(placeId)}/photos/${index}`;
}
