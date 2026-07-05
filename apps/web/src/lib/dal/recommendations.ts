import "server-only";

import { withAuthRls } from "@/lib/auth/with-auth-rls";
import { countSavedInCircleByPlaceIds } from "@/lib/dal/saved-count";
import { toSpotDto, type SpotDto } from "@/lib/dal/spot-dto";

export type RecommendationDto = {
  spot: SpotDto;
  assertion: string;
  evidence: string;
  alternatives: SpotDto[];
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

function utcTodayDate(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

/** GET /home/recommendation (#42): today's row for the authenticated user. */
export async function getHomeRecommendation(
  uid: string,
): Promise<RecommendationDto | null> {
  return withAuthRls(uid, async (tx) => {
    const validDate = utcTodayDate();
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
        spot: { select: spotSelect },
      },
    });
    if (!row) {
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
      row.spot.placeId,
      ...alternatives.map((spot) => spot.placeId),
    ];
    const savedCounts = await countSavedInCircleByPlaceIds(tx, placeIds);

    return {
      spot: toSpotDto(row.spot, savedCounts.get(row.spot.placeId) ?? 0),
      assertion: row.assertion,
      evidence: row.evidence,
      alternatives: alternatives.map((spot) =>
        toSpotDto(spot, savedCounts.get(spot.placeId) ?? 0),
      ),
    };
  });
}
