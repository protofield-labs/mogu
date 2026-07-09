import "server-only";

import type { Recommendation } from "@/lib/agent/types";
import { withAuthRls } from "@/lib/auth/with-auth-rls";
import { hasRecollectedSourceSpot } from "@/lib/dal/recollect-state";
import { countSavedInCircleByPlaceIds } from "@/lib/dal/saved-count";
import { toSpotDto } from "@/lib/dal/spot-dto";
import { pickDailyRecommendation } from "@/lib/recommendations/pick";
import { withPersonaTasteEvidence } from "@/lib/agent/stream-parser";

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
 * Build a Recommendation card payload for agent assertion turns (#161 / #270).
 * Uses the same spot-picking rules as the daily batch, with the agent text as assertion.
 * When a persona taste hint is available, prefix it onto evidence (demo 案1; DB tools are #264).
 */
export async function buildAgentRecommendation(
  uid: string,
  assertionText: string,
  personaTasteHint: string | null = null,
): Promise<Recommendation | null> {
  const trimmedAssertion = assertionText.trim();
  if (trimmedAssertion.length === 0) {
    return null;
  }

  return withAuthRls(uid, async (tx) => {
    const picked = await pickDailyRecommendation(tx, uid);
    if (!picked) {
      return null;
    }

    const spot = await tx.spot.findUnique({
      where: { id: picked.spotId },
      select: spotSelect,
    });
    if (!spot) {
      return null;
    }

    const alternatives = await tx.spot.findMany({
      where: {
        id: { not: picked.spotId },
        rating: "again",
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 2,
      select: spotSelect,
    });

    const placeIds = [spot.placeId, ...alternatives.map((alt) => alt.placeId)];
    const savedCounts = await countSavedInCircleByPlaceIds(tx, placeIds);
    const savedByMe = await hasRecollectedSourceSpot(tx, uid, spot.id);

    return {
      spot: toSpotDto(spot, savedCounts.get(spot.placeId) ?? 0),
      assertion: trimmedAssertion,
      evidence: withPersonaTasteEvidence(picked.evidence, personaTasteHint),
      alternatives: alternatives.map((alt) =>
        toSpotDto(alt, savedCounts.get(alt.placeId) ?? 0),
      ),
      savedByMe,
    };
  });
}
