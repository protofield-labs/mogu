import type { GeoPoint } from "@/lib/places/geo";

/** Stable string key for marker-set changes (FitMapViewport dependency). */
export function encodeMapMarkerKey(points: GeoPoint[]): string {
  return points
    .map((point) => `${point.lat},${point.lng}`)
    .sort()
    .join("|");
}

export function decodeMapMarkerKey(key: string): GeoPoint[] {
  if (key.length === 0) {
    return [];
  }

  return key
    .split("|")
    .map((entry) => {
      const [lat, lng] = entry.split(",").map(Number);
      return { lat, lng };
    })
    .filter((point) => !Number.isNaN(point.lat) && !Number.isNaN(point.lng));
}
