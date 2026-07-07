import "server-only";

import { pickAutoCoverUrls } from "@/lib/collections/cover";
import { withAuthRls } from "@/lib/auth/with-auth-rls";
import { toSpotDto, type SpotDto } from "@/lib/dal/spot-dto";
import { countSavedInCircleByPlaceIds } from "@/lib/dal/saved-count";
import { DEFAULT_COLLECTION_NAME } from "@/lib/recollect/constants";

export type CollectionVisibilityValue = "friends" | "secret";

export type CollectionDto = {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  coverUrl: string | null;
  autoCoverUrls: string[];
  sortOrder: number;
  visibility: CollectionVisibilityValue;
  theme: string | null;
  spotCount: number;
  createdAt: string;
  updatedAt: string;
};

export type { SpotDto };

export type CollectionDetailDto = CollectionDto & {
  spots: SpotDto[];
};

export type CreateCollectionInput = {
  name: string;
  description?: string;
  visibility: CollectionVisibilityValue;
  theme?: string;
};

export type UpdateCollectionInput = {
  name?: string;
  description?: string | null;
  coverUrl?: string | null;
  sortOrder?: number;
  visibility?: CollectionVisibilityValue;
  theme?: string | null;
};

function toCollectionDto(
  collection: {
    id: string;
    ownerId: string;
    name: string;
    description: string | null;
    coverUrl: string | null;
    sortOrder: number;
    visibility: CollectionVisibilityValue;
    theme: string | null;
    createdAt: Date;
    updatedAt: Date;
    _count?: { spots: number };
  },
  autoCoverUrls: string[] = [],
): CollectionDto {
  return {
    id: collection.id,
    ownerId: collection.ownerId,
    name: collection.name,
    description: collection.description,
    coverUrl: collection.coverUrl,
    autoCoverUrls,
    sortOrder: collection.sortOrder,
    visibility: collection.visibility,
    theme: collection.theme,
    spotCount: collection._count?.spots ?? 0,
    createdAt: collection.createdAt.toISOString(),
    updatedAt: collection.updatedAt.toISOString(),
  };
}

function buildAutoCoverMap(
  spots: Array<{ collectionId: string; photoUrls: string[] }>,
): Map<string, string[]> {
  const grouped = new Map<string, Array<{ photoUrls: string[] }>>();
  for (const spot of spots) {
    const current = grouped.get(spot.collectionId) ?? [];
    current.push({ photoUrls: spot.photoUrls });
    grouped.set(spot.collectionId, current);
  }

  const result = new Map<string, string[]>();
  for (const [collectionId, collectionSpots] of grouped) {
    result.set(collectionId, pickAutoCoverUrls(collectionSpots));
  }
  return result;
}

export async function listCollections(
  uid: string,
  ownerId: string,
): Promise<CollectionDto[]> {
  const { collections, autoCoverMap } = await withAuthRls(uid, async (tx) => {
    const rows = await tx.collection.findMany({
      where: { ownerId },
      include: { _count: { select: { spots: true } } },
      orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }, { createdAt: "desc" }],
    });

    if (rows.length === 0) {
      return { collections: rows, autoCoverMap: new Map<string, string[]>() };
    }

    const spots = await tx.spot.findMany({
      where: {
        collectionId: { in: rows.map((row) => row.id) },
        photoUrls: { isEmpty: false },
      },
      orderBy: { createdAt: "desc" },
      select: { collectionId: true, photoUrls: true },
    });

    return {
      collections: rows,
      autoCoverMap: buildAutoCoverMap(spots),
    };
  });

  return collections.map((collection) =>
    toCollectionDto(collection, autoCoverMap.get(collection.id) ?? []),
  );
}

/** Create the default onboarding collection when the user has none (#117). */
export async function ensureDefaultCollection(uid: string): Promise<CollectionDto | null> {
  return withAuthRls(uid, async (tx) => {
    const existingCount = await tx.collection.count({ where: { ownerId: uid } });
    if (existingCount > 0) {
      return null;
    }

    const collection = await tx.collection.create({
      data: {
        ownerId: uid,
        name: DEFAULT_COLLECTION_NAME,
        visibility: "friends",
        sortOrder: 0,
      },
      include: { _count: { select: { spots: true } } },
    });

    return toCollectionDto(collection);
  });
}

export async function createCollection(
  uid: string,
  input: CreateCollectionInput,
): Promise<CollectionDto> {
  const collection = await withAuthRls(uid, async (tx) => {
    const maxSort = await tx.collection.aggregate({
      where: { ownerId: uid },
      _max: { sortOrder: true },
    });
    const sortOrder = (maxSort._max.sortOrder ?? -1) + 1;
    return tx.collection.create({
      data: {
        ownerId: uid,
        name: input.name,
        visibility: input.visibility,
        sortOrder,
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.theme !== undefined ? { theme: input.theme } : {}),
      },
      include: { _count: { select: { spots: true } } },
    });
  });

  return toCollectionDto(collection);
}

export async function getCollectionDetail(
  uid: string,
  id: string,
): Promise<CollectionDetailDto | null> {
  const detail = await withAuthRls(uid, async (tx) => {
    const collection = await tx.collection.findUnique({
      where: { id },
      include: {
        _count: { select: { spots: true } },
        spots: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!collection) {
      return null;
    }

    const placeIds = [...new Set(collection.spots.map((spot) => spot.placeId))];
    const savedCounts = await countSavedInCircleByPlaceIds(tx, placeIds);

    return {
      collection,
      spots: collection.spots.map((spot) =>
        toSpotDto(spot, savedCounts.get(spot.placeId) ?? 0),
      ),
    };
  });

  if (!detail) {
    return null;
  }

  return {
    ...toCollectionDto(
      detail.collection,
      pickAutoCoverUrls(detail.spots),
    ),
    spots: detail.spots,
  };
}

export type OwnedCollectionMutationResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: "not_found" | "forbidden" };

export async function updateCollection(
  uid: string,
  id: string,
  input: UpdateCollectionInput,
): Promise<OwnedCollectionMutationResult<CollectionDto>> {
  const data: UpdateCollectionInput = {};
  if (input.name !== undefined) {
    data.name = input.name;
  }
  if (input.description !== undefined) {
    data.description = input.description;
  }
  if (input.coverUrl !== undefined) {
    data.coverUrl = input.coverUrl;
  }
  if (input.sortOrder !== undefined) {
    data.sortOrder = input.sortOrder;
  }
  if (input.visibility !== undefined) {
    data.visibility = input.visibility;
  }
  if (input.theme !== undefined) {
    data.theme = input.theme;
  }

  const result = await withAuthRls(uid, async (tx) => {
    const existing = await tx.collection.findUnique({
      where: { id },
      select: { ownerId: true },
    });
    if (!existing) {
      return { ok: false as const, reason: "not_found" as const };
    }
    if (existing.ownerId !== uid) {
      return { ok: false as const, reason: "forbidden" as const };
    }

    const updated = await tx.collection.update({
      where: { id },
      data,
      include: { _count: { select: { spots: true } } },
    });
    return { ok: true as const, value: updated };
  });

  if (!result.ok) {
    return result;
  }

  const autoCoverUrls = await withAuthRls(uid, async (tx) => {
    const spots = await tx.spot.findMany({
      where: { collectionId: id, photoUrls: { isEmpty: false } },
      orderBy: { createdAt: "desc" },
      select: { photoUrls: true },
    });
    return pickAutoCoverUrls(spots);
  });

  return { ok: true, value: toCollectionDto(result.value, autoCoverUrls) };
}

export async function reorderCollections(
  uid: string,
  orderedIds: string[],
): Promise<OwnedCollectionMutationResult<CollectionDto[]>> {
  if (orderedIds.length === 0) {
    return { ok: false, reason: "not_found" };
  }

  const result = await withAuthRls(uid, async (tx) => {
    const owned = await tx.collection.findMany({
      where: { ownerId: uid },
      select: { id: true },
      orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
    });
    const ownedIds = owned.map((row) => row.id);
    if (
      orderedIds.length !== ownedIds.length ||
      !orderedIds.every((id) => ownedIds.includes(id))
    ) {
      return { ok: false as const, reason: "forbidden" as const };
    }

    await Promise.all(
      orderedIds.map((id, index) =>
        tx.collection.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );

    const rows = await tx.collection.findMany({
      where: { ownerId: uid },
      include: { _count: { select: { spots: true } } },
      orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
    });

    const spots = await tx.spot.findMany({
      where: {
        collectionId: { in: rows.map((row) => row.id) },
        photoUrls: { isEmpty: false },
      },
      orderBy: { createdAt: "desc" },
      select: { collectionId: true, photoUrls: true },
    });

    return {
      ok: true as const,
      value: {
        rows,
        autoCoverMap: buildAutoCoverMap(spots),
      },
    };
  });

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    value: result.value.rows.map((row) =>
      toCollectionDto(row, result.value.autoCoverMap.get(row.id) ?? []),
    ),
  };
}

export async function deleteCollection(
  uid: string,
  id: string,
): Promise<OwnedCollectionMutationResult<true>> {
  return withAuthRls(uid, async (tx) => {
    const existing = await tx.collection.findUnique({
      where: { id },
      select: { ownerId: true },
    });
    if (!existing) {
      return { ok: false as const, reason: "not_found" as const };
    }
    if (existing.ownerId !== uid) {
      return { ok: false as const, reason: "forbidden" as const };
    }

    await tx.collection.delete({ where: { id } });
    return { ok: true as const, value: true as const };
  });
}
