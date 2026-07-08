import "server-only";

import type { Prisma } from "@prisma/client";

import { withAuthRls } from "@/lib/auth/with-auth-rls";

type LikeSpotResult = { ok: true } | { ok: false; reason: "not_found" };

/** Idempotent like on a circle-visible spot (#212). */
export async function likeSpot(
  uid: string,
  spotId: string,
): Promise<LikeSpotResult> {
  return withAuthRls(uid, async (tx) => {
    const spot = await tx.spot.findFirst({
      where: { id: spotId },
      select: { id: true },
    });
    if (!spot) {
      return { ok: false, reason: "not_found" };
    }

    await tx.spotLike.upsert({
      where: {
        userId_spotId: {
          userId: uid,
          spotId,
        },
      },
      create: {
        userId: uid,
        spotId,
      },
      update: {},
    });

    return { ok: true };
  });
}

/** Idempotent unlike (#212). */
export async function unlikeSpot(
  uid: string,
  spotId: string,
): Promise<LikeSpotResult> {
  return withAuthRls(uid, async (tx) => {
    const spot = await tx.spot.findFirst({
      where: { id: spotId },
      select: { id: true },
    });
    if (!spot) {
      return { ok: false, reason: "not_found" };
    }

    await tx.spotLike.deleteMany({
      where: {
        userId: uid,
        spotId,
      },
    });

    return { ok: true };
  });
}

/** Circle-relative like counts per spot id (erd-api §5 pattern). */
export async function countLikesInCircleBySpotIds(
  tx: Prisma.TransactionClient,
  spotIds: string[],
): Promise<Map<string, number>> {
  if (spotIds.length === 0) {
    return new Map();
  }

  const rows = await tx.$queryRaw<{ spot_id: string; count: bigint }[]>`
    SELECT sl.spot_id, count(DISTINCT sl.user_id)::bigint AS count
    FROM spot_likes sl
    WHERE sl.spot_id = ANY(${spotIds}::uuid[])
      AND (
        sl.user_id = app_current_user()
        OR are_friends(sl.user_id, app_current_user())
      )
    GROUP BY sl.spot_id
  `;

  return new Map(rows.map((row) => [row.spot_id, Number(row.count)]));
}

/** Spot ids the viewer has liked. */
export async function getLikedSpotIds(
  tx: Prisma.TransactionClient,
  viewerUid: string,
  spotIds: string[],
): Promise<Set<string>> {
  if (spotIds.length === 0) {
    return new Set();
  }

  const rows = await tx.spotLike.findMany({
    where: {
      userId: viewerUid,
      spotId: { in: spotIds },
    },
    select: { spotId: true },
  });

  return new Set(rows.map((row) => row.spotId));
}
