import "server-only";

import { withAuthRls } from "@/lib/auth/with-auth-rls";

export type SpotDto = {
  id: string;
  placeId: string;
  addedBy: string;
  collectionId: string;
  photoUrls: string[];
  comment: string;
  rating: "again" | "either" | "no";
  structuredTags: {
    area: string | null;
    genre: string | null;
    situation: string | null;
  };
  freeTags: string[];
  savedCount: number;
  originUserId: string | null;
  createdAt: string;
};

export type RecollectSpotResult =
  | { ok: true; spot: SpotDto }
  | { ok: false; reason: "not_found" | "forbidden" };

async function countSavedInCircle(
  tx: Parameters<Parameters<typeof withAuthRls>[1]>[0],
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

function toSpotDto(
  spot: {
    id: string;
    placeId: string;
    addedBy: string;
    collectionId: string;
    photoUrls: string[];
    comment: string;
    rating: "again" | "either" | "no";
    tagArea: string | null;
    tagGenre: string | null;
    tagSituation: string | null;
    freeTags: string[];
    originUserId: string | null;
    depth: number;
    createdAt: Date;
  },
  savedCount: number,
): SpotDto {
  return {
    id: spot.id,
    placeId: spot.placeId,
    addedBy: spot.addedBy,
    collectionId: spot.collectionId,
    photoUrls: spot.photoUrls,
    comment: spot.comment,
    rating: spot.rating,
    structuredTags: {
      area: spot.tagArea,
      genre: spot.tagGenre,
      situation: spot.tagSituation,
    },
    freeTags: spot.freeTags,
    savedCount,
    originUserId: spot.depth >= 2 ? null : spot.originUserId,
    createdAt: spot.createdAt.toISOString(),
  };
}

/**
 * Copy a visible spot into the viewer's collection (#40 / erd-api §3).
 * Runs in one RLS-scoped transaction; flag emission is handled by DB trigger.
 */
export async function recollectSpot(
  uid: string,
  sourceSpotId: string,
  targetCollectionId: string,
): Promise<RecollectSpotResult> {
  const result = await withAuthRls(uid, async (tx) => {
    const source = await tx.spot.findUnique({
      where: { id: sourceSpotId },
    });
    if (!source) {
      return { ok: false as const, reason: "not_found" as const };
    }

    const targetCollection = await tx.collection.findUnique({
      where: { id: targetCollectionId },
      select: { id: true, ownerId: true },
    });
    if (!targetCollection || targetCollection.ownerId !== uid) {
      return { ok: false as const, reason: "forbidden" as const };
    }

    const originUserId = source.originUserId ?? source.addedBy;
    const depth = source.depth + 1;

    const created = await tx.spot.create({
      data: {
        placeId: source.placeId,
        addedBy: uid,
        collectionId: targetCollectionId,
        photoUrls: [],
        comment: "",
        rating: "either",
        originUserId,
        depth,
      },
    });

    await tx.recollectionEdge.create({
      data: {
        spotId: created.id,
        sourceSpotId: source.id,
        actorId: uid,
        originUserId,
        depth,
      },
    });

    const savedCount = await countSavedInCircle(tx, created.placeId);
    return {
      ok: true as const,
      spot: toSpotDto(created, savedCount),
    };
  });

  return result;
}
