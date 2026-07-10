import "server-only";

import { withAuthRls } from "@/lib/auth/with-auth-rls";
import { countSavedInCircleByPlaceIds } from "@/lib/dal/saved-count";
import { hasRecollectedSourceSpot } from "@/lib/dal/recollect-state";
import { toSpotDto, type SpotDto } from "@/lib/dal/spot-dto";
import { spotCoreSelect } from "@/lib/dal/spot-select";
import { jstTodayDate } from "@/lib/recommendations/valid-date";

export type RecommendationDto = {
  spot: SpotDto;
  assertion: string;
  evidence: string;
  alternatives: SpotDto[];
  savedByMe: boolean;
};

const recommendationRowSelect = {
  assertion: true,
  evidence: true,
  spotId: true,
} as const;

/**
 * GET /home/recommendation (#42 / #252).
 * Prefer today's JST row; if the 4:00 JST batch has not run yet (0:00–3:59)
 * or failed, fall back to the newest existing row for this user.
 */
export async function getHomeRecommendation(
  uid: string,
): Promise<RecommendationDto | null> {
  return withAuthRls(uid, async (tx) => {
    const validDate = jstTodayDate();
    let row = await tx.dailyRecommendation.findUnique({
      where: {
        userId_validDate: {
          userId: uid,
          validDate,
        },
      },
      select: recommendationRowSelect,
    });

    if (!row) {
      // Overnight gap before the 4:00 JST batch, or a missed batch day (#252).
      row = await tx.dailyRecommendation.findFirst({
        where: { userId: uid },
        orderBy: [{ validDate: "desc" }, { generatedAt: "desc" }],
        select: recommendationRowSelect,
      });
    }

    if (!row) {
      return null;
    }

    // Fetch via spot table so RLS applies: the spot may have become
    // invisible since the batch ran (unfriended / collection made secret).
    const spot = await tx.spot.findUnique({
      where: { id: row.spotId },
      select: spotCoreSelect,
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
      select: spotCoreSelect,
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
