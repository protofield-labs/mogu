/** Client-side Maps JavaScript API key (build-time public env). */
export function readGoogleMapsApiKey(): string | null {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
  return key && key.length > 0 ? key : null;
}

export const DEFAULT_MAP_CENTER = { lat: 35.6812, lng: 139.7671 } as const;
