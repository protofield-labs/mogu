import "server-only";

import { withAuthRls } from "@/lib/auth/with-auth-rls";
import { countSavedInCircleByPlaceIds } from "@/lib/dal/saved-count";
import { hasRecollectedSourceSpot } from "@/lib/dal/recollect-state";
import { toSpotDto, type SpotDto } from "@/lib/dal/spot-dto";
import { jstTodayDate } from "@/lib/recommendations/valid-date";

export type RecommendationDto = {
  spot: SpotDto;
  assertion: string;
  evidence: string;
  alternatives: SpotDto[];
  savedByMe: boolean;
};

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

/** GET /home/recommendation (#42): today's row for the authenticated user. */
export async function getHomeRecommendation(
  uid: string,
): Promise<RecommendationDto | null> {
  return withAuthRls(uid, async (tx) => {
    const validDate = jstTodayDate();
    const row = await tx.dailyRecommendation.findUnique({
      where: {
        userId_validDate: {
          userId: uid,
          validDate,
        },
      },
      select: {
        assertion: true,
        evidence: true,
        spotId: true,
      },
    });
    if (!row) {
      return null;
    }

    // Fetch via spot table so RLS applies: the spot may have become
    // invisible since the batch ran (unfriended / collection made secret).
    const spot = await tx.spot.findUnique({
      where: { id: row.spotId },
      select: spotSelect,
    });
    if (!spot) {
      return null;
    }

    const alternatives = await tx.spot.findMany({
      where: {
        id: { not: row.spotId },
        rating: "again",
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 2,
      select: spotSelect,
    });

    const placeIds = [
      spot.placeId,
      ...alternatives.map((alt) => alt.placeId),
    ];
    const savedCounts = await countSavedInCircleByPlaceIds(tx, placeIds);
    const savedByMe = await hasRecollectedSourceSpot(tx, uid, spot.id);

    return {
      spot: toSpotDto(spot, savedCounts.get(spot.placeId) ?? 0),
      assertion: row.assertion,
      evidence: row.evidence,
      alternatives: alternatives.map((alt) =>
        toSpotDto(alt, savedCounts.get(alt.placeId) ?? 0),
      ),
      savedByMe,
    };
  });
}
