import type { Rating } from "@prisma/client";

import type { PrismaTransaction } from "@/lib/db/prisma";

const RATING_LABEL: Record<Rating, string> = {
  again: "すき",
  either: "ふつう",
  no: "もういい",
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
 * When preferAddedByUids is set (agent persona turns, #271), try those friends first.
 * When anchorSpotId is set (agent follow-up, #264), keep that spot if still visible.
 */
export async function pickDailyRecommendation(
  tx: PrismaTransaction,
  viewerUid: string,
  options?: { preferAddedByUids?: string[]; anchorSpotId?: string },
): Promise<GeneratedDailyRecommendation | null> {
  const preferredUids = (options?.preferAddedByUids ?? []).filter(
    (uid) => uid && uid !== viewerUid,
  );

  if (options?.anchorSpotId) {
    const anchored = await tx.spot.findFirst({
      where: { id: options.anchorSpotId },
      select: candidateSelect,
    });
    if (!anchored) {
      // Do not fall through to a different spot while the caller may reuse
      // the prior assertion text (#264).
      return null;
    }
    const savedCount = await countSavedInCircle(tx, anchored.placeId);
    return {
      spotId: anchored.id,
      assertion: buildAssertion(anchored),
      evidence: buildEvidence(
        anchored.addedByUser.displayName,
        anchored.rating,
        savedCount,
      ),
    };
  }

  let preferredSpot: CandidateSpot | null = null;
  for (const addedBy of preferredUids) {
    preferredSpot = await tx.spot.findFirst({
      where: { rating: "again", addedBy },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: candidateSelect,
    });
    if (preferredSpot) {
      break;
    }
  }

  const friendSpot = preferredSpot
    ? null
    : await tx.spot.findFirst({
        where: {
          rating: "again",
          addedBy: {
            notIn: [viewerUid, ...preferredUids],
          },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: candidateSelect,
      });

  const ownSpot =
    preferredSpot || friendSpot
      ? null
      : await tx.spot.findFirst({
          where: { rating: "again", addedBy: viewerUid },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: candidateSelect,
        });

  const fallback =
    preferredSpot || friendSpot || ownSpot
      ? null
      : await tx.spot.findFirst({
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: candidateSelect,
        });

  const chosen = preferredSpot ?? friendSpot ?? ownSpot ?? fallback;
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
