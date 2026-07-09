import "server-only";

import type { CandidateSpotRef, Spot } from "./types";
import type { CandidateSpotMarker } from "./candidate-spot-markers";
import type { CandidatePinContext } from "./followup-context";
import { withAuthRls } from "@/lib/auth/with-auth-rls";
import { countSavedInCircleByPlaceIds } from "@/lib/dal/saved-count";
import { toSpotDto } from "@/lib/dal/spot-dto";

const spotSelect = {
  id: true,
  placeId: true,
  addedBy: true,
  collectionId: true,
  photoUrls: true,
  comment: true,
  rating: true,
  tagArea: true,
  tagGenre: true,
  tagSituation: true,
  freeTags: true,
  originUserId: true,
  depth: true,
  createdAt: true,
} as const;

/**
 * Resolve candidate markers from an agent reply into Spot DTOs (#287).
 * RLS keeps this to spots the viewer can actually see; hallucinated
 * spot_id/place_id pairs are silently dropped.
 */
export async function buildAgentCandidateSpots(
  uid: string,
  markers: CandidateSpotMarker[],
): Promise<Spot[]> {
  if (markers.length === 0) {
    return [];
  }

  return withAuthRls(uid, async (tx) => {
    const rows = await tx.spot.findMany({
      where: { id: { in: markers.map((marker) => marker.spotId) } },
      select: spotSelect,
    });
    const rowById = new Map(rows.map((row) => [row.id, row]));

    const matched = markers.flatMap((marker) => {
      const row = rowById.get(marker.spotId);
      // Guard against the model pairing a real spot_id with a wrong place_id.
      return row && row.placeId === marker.placeId ? [row] : [];
    });
    if (matched.length === 0) {
      return [];
    }

    const savedCounts = await countSavedInCircleByPlaceIds(
      tx,
      matched.map((row) => row.placeId),
    );
    return matched.map((row) =>
      toSpotDto(row, savedCounts.get(row.placeId) ?? 0),
    );
  });
}

/**
 * Validate a tapped candidate reference and load pin context for the
 * follow-up turn (#287). Returns null when the spot is not visible to the
 * viewer or the place_id does not match — the turn then falls back to the
 * normal follow-up flow.
 */
export async function getCandidatePinContext(
  uid: string,
  ref: CandidateSpotRef,
): Promise<CandidatePinContext | null> {
  return withAuthRls(uid, async (tx) => {
    const row = await tx.spot.findFirst({
      where: { id: ref.spotId },
      select: {
        id: true,
        placeId: true,
        tagArea: true,
        tagGenre: true,
        tagSituation: true,
        comment: true,
      },
    });
    if (!row || row.placeId !== ref.placeId) {
      return null;
    }

    const tagLine = [row.tagArea, row.tagGenre, row.tagSituation]
      .filter(Boolean)
      .join(" / ");
    return {
      spotId: row.id,
      placeId: row.placeId,
      tagLine: tagLine || null,
      comment: row.comment || null,
    };
  });
}
