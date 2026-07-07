import "server-only";

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
  visibility?: CollectionVisibilityValue;
  theme?: string | null;
};

function toCollectionDto(collection: {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  coverUrl: string | null;
  visibility: CollectionVisibilityValue;
  theme: string | null;
  createdAt: Date;
  updatedAt: Date;
  _count?: { spots: number };
}): CollectionDto {
  return {
    id: collection.id,
    ownerId: collection.ownerId,
    name: collection.name,
    description: collection.description,
    coverUrl: collection.coverUrl,
    visibility: collection.visibility,
    theme: collection.theme,
    spotCount: collection._count?.spots ?? 0,
    createdAt: collection.createdAt.toISOString(),
    updatedAt: collection.updatedAt.toISOString(),
  };
}

export async function listCollections(
  uid: string,
  ownerId: string,
): Promise<CollectionDto[]> {
  const collections = await withAuthRls(uid, (tx) =>
    tx.collection.findMany({
      where: { ownerId },
      include: { _count: { select: { spots: true } } },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    }),
  );

  return collections.map(toCollectionDto);
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
  const collection = await withAuthRls(uid, (tx) =>
    tx.collection.create({
      data: {
        ownerId: uid,
        name: input.name,
        visibility: input.visibility,
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.theme !== undefined ? { theme: input.theme } : {}),
      },
      include: { _count: { select: { spots: true } } },
    }),
  );

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
    ...toCollectionDto(detail.collection),
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
  if (input.visibility !== undefined) {
    data.visibility = input.visibility;
  }
  if (input.theme !== undefined) {
    data.theme = input.theme;
  }

  const result = await withAuthRls(uid, async (tx) => {
    // RLS makes friends' collections readable, so an explicit owner check is
    // needed here: without it the UPDATE matches 0 rows and Prisma throws.
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

  return result.ok
    ? { ok: true, value: toCollectionDto(result.value) }
    : result;
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
