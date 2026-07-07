import type { CollectionDetail } from "@/lib/collections/browser-api";
import type { Spot } from "@/lib/spots/browser-api";

const RATING_PRIORITY: Record<Spot["rating"], number> = {
  again: 0,
  either: 1,
  no: 2,
};

/** Prefer stronger rating, then newer spot when placeId collides on the map. */
export function pickSpotForMapPin(existing: Spot, candidate: Spot): Spot {
  const existingPriority = RATING_PRIORITY[existing.rating];
  const candidatePriority = RATING_PRIORITY[candidate.rating];
  if (candidatePriority !== existingPriority) {
    return candidatePriority < existingPriority ? candidate : existing;
  }
  return candidate.createdAt > existing.createdAt ? candidate : existing;
}

export function dedupeSpotsForMap(spots: Spot[]): Spot[] {
  const byPlaceId = new Map<string, Spot>();
  for (const spot of spots) {
    const current = byPlaceId.get(spot.placeId);
    byPlaceId.set(
      spot.placeId,
      current ? pickSpotForMapPin(current, spot) : spot,
    );
  }
  return Array.from(byPlaceId.values());
}

export function mergeCollectionSpots(details: CollectionDetail[]): {
  spots: Spot[];
  collectionNameBySpotId: Record<string, string>;
} {
  const collectionNameBySpotId: Record<string, string> = {};
  const spots: Spot[] = [];

  for (const detail of details) {
    for (const spot of detail.spots) {
      spots.push(spot);
      collectionNameBySpotId[spot.id] = detail.name;
    }
  }

  return { spots, collectionNameBySpotId };
}
