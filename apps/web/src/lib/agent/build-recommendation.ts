import "server-only";

import type { Recommendation } from "@/lib/agent/types";
import { withAuthRls } from "@/lib/auth/with-auth-rls";
import { hasRecollectedSourceSpot } from "@/lib/dal/recollect-state";
import { countSavedInCircleByPlaceIds } from "@/lib/dal/saved-count";
import { toSpotDto } from "@/lib/dal/spot-dto";
import { pickDailyRecommendation } from "@/lib/recommendations/pick";
import {
  AGENT_PERSONA_BY_KEY,
  type PersonaKey,
} from "@/lib/agent/persona-config";
import { sanitizeAgentPublicEvidence } from "@/lib/agent/stream-parser";

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
 * Build a Recommendation card payload for agent assertion turns (#161 / #270 / #271).
 * Uses the same spot-picking rules as the daily batch; assertion text comes from
 * the picked spot (tag-based), not the model reply, so hallucinated shop names
 * never appear on the card.
 */
export async function buildAgentRecommendation(
  uid: string,
  _personaTasteHint: string | null = null,
  personaKey: PersonaKey | null = null,
  options?: { anchorSpotId?: string },
): Promise<Recommendation | null> {
  const preferAddedByUids = personaKey
    ? [AGENT_PERSONA_BY_KEY[personaKey].ownerId]
    : [];
  const anchorSpotId = options?.anchorSpotId;

  return withAuthRls(uid, async (tx) => {
    const picked = await pickDailyRecommendation(tx, uid, {
      preferAddedByUids,
      ...(anchorSpotId ? { anchorSpotId } : {}),
    });
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
        ...(preferAddedByUids.length > 0
          ? { addedBy: { in: preferAddedByUids } }
          : {}),
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
      assertion: picked.assertion,
      evidence: sanitizeAgentPublicEvidence(picked.evidence),
      alternatives: alternatives.map((alt) =>
        toSpotDto(alt, savedCounts.get(alt.placeId) ?? 0),
      ),
      savedByMe,
    };
  });
}
