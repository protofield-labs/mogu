export type GeoPoint = {
  lat: number;
  lng: number;
};

const EARTH_RADIUS_M = 6371000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Great-circle distance in meters (Haversine). */
export function haversineMeters(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatDistanceMeters(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}

export function sortSpotsByDistance<T extends { placeId: string }>(
  spots: T[],
  origin: GeoPoint | null,
  locations: Record<string, GeoPoint>,
): T[] {
  if (!origin) {
    return spots;
  }

  return [...spots].sort((left, right) => {
    const leftLocation = locations[left.placeId];
    const rightLocation = locations[right.placeId];
    if (!leftLocation && !rightLocation) {
      return 0;
    }
    if (!leftLocation) {
      return 1;
    }
    if (!rightLocation) {
      return -1;
    }
    return (
      haversineMeters(origin, leftLocation) -
      haversineMeters(origin, rightLocation)
    );
  });
}

export function spotDistanceLabels(
  spots: Array<{ id: string; placeId: string }>,
  origin: GeoPoint | null,
  locations: Record<string, GeoPoint>,
): Record<string, string> {
  if (!origin) {
    return {};
  }

  const labels: Record<string, string> = {};
  for (const spot of spots) {
    const location = locations[spot.placeId];
    if (location) {
      labels[spot.id] = formatDistanceMeters(haversineMeters(origin, location));
    }
  }
  return labels;
}
