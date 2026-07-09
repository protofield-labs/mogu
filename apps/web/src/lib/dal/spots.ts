import "server-only";

import { withAuthRls } from "@/lib/auth/with-auth-rls";
import { toSpotDto, type SpotDto } from "@/lib/dal/spot-dto";
import { countSavedInCircle } from "@/lib/dal/saved-count";

export type { SpotDto };

export type RecollectSpotResult =
  | { ok: true; spot: SpotDto }
  | { ok: false; reason: "not_found" | "forbidden" };

export type CreateSpotInput = {
  placeId: string;
  comment: string;
  rating: "again" | "either" | "no";
  structuredTags?: {
    area?: string | null;
    genre?: string | null;
    situation?: string | null;
  };
  freeTags?: string[];
  photoUrls?: string[];
};

export type UpdateSpotInput = {
  comment?: string;
  rating?: "again" | "either" | "no";
  structuredTags?: {
    area?: string | null;
    genre?: string | null;
    situation?: string | null;
  };
  freeTags?: string[];
  photoUrls?: string[];
};

export type SpotMutationResult =
  | { ok: true; spot: SpotDto }
  | { ok: false; reason: "not_found" | "forbidden" };

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
    if (source.addedBy === uid) {
      return { ok: false as const, reason: "forbidden" as const };
    }

    const targetCollection = await tx.collection.findUnique({
      where: { id: targetCollectionId },
      select: { id: true, ownerId: true },
    });
    if (!targetCollection || targetCollection.ownerId !== uid) {
      return { ok: false as const, reason: "forbidden" as const };
    }

    // Idempotency: repeated recollects of the same source must not spam the
    // origin user with flags (trigger fires on every edge INSERT).
    const existingEdge = await tx.recollectionEdge.findFirst({
      where: { actorId: uid, sourceSpotId: source.id },
      select: { spotId: true },
      orderBy: { createdAt: "asc" },
    });
    if (existingEdge) {
      const existingSpot = await tx.spot.findUnique({
        where: { id: existingEdge.spotId },
      });
      if (existingSpot) {
        const savedCount = await countSavedInCircle(tx, existingSpot.placeId);
        return {
          ok: true as const,
          spot: toSpotDto(existingSpot, savedCount),
        };
      }
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

/** Add a spot to an owned collection (#34 / erd-api spots_insert). */
export async function createSpot(
  uid: string,
  collectionId: string,
  input: CreateSpotInput,
): Promise<SpotMutationResult> {
  return withAuthRls(uid, async (tx) => {
    const collection = await tx.collection.findUnique({
      where: { id: collectionId },
      select: { id: true, ownerId: true },
    });
    if (!collection) {
      return { ok: false as const, reason: "not_found" as const };
    }
    if (collection.ownerId !== uid) {
      return { ok: false as const, reason: "forbidden" as const };
    }

    const created = await tx.spot.create({
      data: {
        placeId: input.placeId,
        addedBy: uid,
        collectionId,
        comment: input.comment,
        rating: input.rating,
        photoUrls: input.photoUrls ?? [],
        tagArea: input.structuredTags?.area ?? null,
        tagGenre: input.structuredTags?.genre ?? null,
        tagSituation: input.structuredTags?.situation ?? null,
        freeTags: input.freeTags ?? [],
        depth: 0,
      },
    });

    const savedCount = await countSavedInCircle(tx, created.placeId);
    return { ok: true as const, spot: toSpotDto(created, savedCount) };
  });
}

/** Update an owned spot (#34 / spots_update RLS). */
export async function updateSpot(
  uid: string,
  spotId: string,
  input: UpdateSpotInput,
): Promise<SpotMutationResult> {
  return withAuthRls(uid, async (tx) => {
    const existing = await tx.spot.findUnique({ where: { id: spotId } });
    if (!existing) {
      return { ok: false as const, reason: "not_found" as const };
    }
    if (existing.addedBy !== uid) {
      return { ok: false as const, reason: "forbidden" as const };
    }

    const updated = await tx.spot.update({
      where: { id: spotId },
      data: {
        ...(input.comment !== undefined ? { comment: input.comment } : {}),
        ...(input.rating !== undefined ? { rating: input.rating } : {}),
        ...(input.photoUrls !== undefined ? { photoUrls: input.photoUrls } : {}),
        ...(input.freeTags !== undefined ? { freeTags: input.freeTags } : {}),
        ...(input.structuredTags?.area !== undefined
          ? { tagArea: input.structuredTags.area }
          : {}),
        ...(input.structuredTags?.genre !== undefined
          ? { tagGenre: input.structuredTags.genre }
          : {}),
        ...(input.structuredTags?.situation !== undefined
          ? { tagSituation: input.structuredTags.situation }
          : {}),
      },
    });

    const savedCount = await countSavedInCircle(tx, updated.placeId);
    return { ok: true as const, spot: toSpotDto(updated, savedCount) };
  });
}

/**
 * Media proxy visibility (#35 / #259): a photo object is viewable when an
 * RLS-visible spot references it in photoUrls, an RLS-visible collection
 * uses it as coverUrl, or any user has it as avatarUrl (public profile).
 */
export async function canViewPhotoUrl(
  uid: string,
  objectUrl: string,
): Promise<boolean> {
  return withAuthRls(uid, async (tx) => {
    const spot = await tx.spot.findFirst({
      where: { photoUrls: { has: objectUrl } },
      select: { id: true },
    });
    if (spot) {
      return true;
    }

    const collection = await tx.collection.findFirst({
      where: { coverUrl: objectUrl },
      select: { id: true },
    });
    if (collection) {
      return true;
    }

    const avatarOwner = await tx.user.findFirst({
      where: { avatarUrl: objectUrl },
      select: { firebaseUid: true },
    });
    return avatarOwner !== null;
  });
}

/** Delete an owned spot (#34 / spots_delete RLS). */
export async function deleteSpot(
  uid: string,
  spotId: string,
): Promise<{ ok: true } | { ok: false; reason: "not_found" | "forbidden" }> {
  return withAuthRls(uid, async (tx) => {
    const existing = await tx.spot.findUnique({ where: { id: spotId } });
    if (!existing) {
      return { ok: false as const, reason: "not_found" as const };
    }
    if (existing.addedBy !== uid) {
      return { ok: false as const, reason: "forbidden" as const };
    }

    await tx.spot.delete({ where: { id: spotId } });
    return { ok: true as const };
  });
}

export type SpotDetailDto = SpotDto & {
  collectionName: string;
  ownerId: string;
};

/** Fetch a visible spot for deeplink pages (#122). */
export async function getSpotDetail(
  uid: string,
  spotId: string,
): Promise<SpotDetailDto | null> {
  const detail = await withAuthRls(uid, async (tx) => {
    const spot = await tx.spot.findUnique({
      where: { id: spotId },
      include: {
        collection: {
          select: { id: true, name: true, ownerId: true },
        },
      },
    });
    if (!spot) {
      return null;
    }

    const savedCount = await countSavedInCircle(tx, spot.placeId);
    return {
      spot,
      savedCount,
    };
  });

  if (!detail) {
    return null;
  }

  return {
    ...toSpotDto(detail.spot, detail.savedCount),
    collectionName: detail.spot.collection.name,
    ownerId: detail.spot.collection.ownerId,
  };
}
