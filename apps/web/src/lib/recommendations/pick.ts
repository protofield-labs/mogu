import type { Rating } from "@prisma/client";

import type { PrismaTransaction } from "@/lib/db/prisma";

const RATING_LABEL: Record<Rating, string> = {
  again: "また行きたい",
  either: "どちらでも",
  no: "また行きたくない",
};

type CandidateSpot = {
  id: string;
  placeId: string;
  addedBy: string;
  rating: Rating;
  tagArea: string | null;
  tagGenre: string | null;
  addedByUser: { displayName: string };
};

export function buildAssertion(spot: CandidateSpot): string {
  if (spot.tagArea && spot.tagGenre) {
    return `今夜は${spot.tagArea}の${spot.tagGenre}がおすすめ`;
  }
  if (spot.tagArea) {
    return `今夜は${spot.tagArea}のこの店がおすすめ`;
  }
  return `${spot.addedByUser.displayName}のおすすめ`;
}

export function buildEvidence(
  actorName: string,
  rating: Rating,
  savedCount: number,
): string {
  return `${actorName}が『${RATING_LABEL[rating]}』・グループで${savedCount}人が保存`;
}

async function countSavedInCircle(
  tx: PrismaTransaction,
  placeId: string,
): Promise<number> {
  const rows = await tx.$queryRaw<{ count: bigint }[]>`
    SELECT count(DISTINCT s.added_by)::bigint AS count
    FROM spots s
    WHERE s.place_id = ${placeId}
      AND (
        s.added_by = app_current_user()
        OR are_friends(s.added_by, app_current_user())
      )
  `;
  return Number(rows[0]?.count ?? 0n);
}

export type GeneratedDailyRecommendation = {
  spotId: string;
  assertion: string;
  evidence: string;
};

const candidateSelect = {
  id: true,
  placeId: true,
  addedBy: true,
  rating: true,
  tagArea: true,
  tagGenre: true,
  addedByUser: { select: { displayName: true } },
} as const;

/**
 * Rule-based daily recommendation (#42 MVP batch).
 * Prefers a friend's newest "again" spot, then own "again", then any visible spot.
 */
export async function pickDailyRecommendation(
  tx: PrismaTransaction,
  viewerUid: string,
): Promise<GeneratedDailyRecommendation | null> {
  const friendSpot = await tx.spot.findFirst({
    where: { rating: "again", addedBy: { not: viewerUid } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: candidateSelect,
  });

  const ownSpot = friendSpot
    ? null
    : await tx.spot.findFirst({
        where: { rating: "again", addedBy: viewerUid },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: candidateSelect,
      });

  const fallback =
    friendSpot || ownSpot
      ? null
      : await tx.spot.findFirst({
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: candidateSelect,
        });

  const chosen = friendSpot ?? ownSpot ?? fallback;
  if (!chosen) {
    return null;
  }

  const savedCount = await countSavedInCircle(tx, chosen.placeId);
  return {
    spotId: chosen.id,
    assertion: buildAssertion(chosen),
    evidence: buildEvidence(
      chosen.addedByUser.displayName,
      chosen.rating,
      savedCount,
    ),
  };
}
