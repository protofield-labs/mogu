import "server-only";

import { withAuthRls } from "@/lib/auth/with-auth-rls";
import { countSavedInCircleByPlaceIds } from "@/lib/dal/saved-count";
import { toSpotDto, type SpotDto } from "@/lib/dal/spot-dto";
import { toUserDto, type UserDto } from "@/lib/dal/users";
import { decodeFeedCursor, encodeFeedCursor } from "@/lib/feed/cursor";

export { decodeFeedCursor, encodeFeedCursor } from "@/lib/feed/cursor";
export type FeedItemDto = {
  spot: SpotDto;
  actor: UserDto;
  collectionName: string;
  createdAt: string;
};

export type FeedPageDto = {
  items: FeedItemDto[];
  nextCursor: string | null;
};

const FEED_PAGE_SIZE = 20;

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
  collection: { select: { name: true } },
  addedByUser: {
    select: {
      firebaseUid: true,
      displayName: true,
      avatarColor: true,
    },
  },
} as const;

/**
 * Chronological feed (#39 / guardrail 3: created_at DESC only, no scoring).
 * RLS limits rows to the viewer's circle-visible spots.
 */
export async function listFeed(
  uid: string,
  cursorRaw?: string | null,
): Promise<FeedPageDto | null> {
  let cursor: { createdAt: Date; id: string } | undefined;
  if (cursorRaw) {
    const decoded = decodeFeedCursor(cursorRaw);
    if (!decoded) {
      return null;
    }
    cursor = decoded;
  }

  return withAuthRls(uid, async (tx) => {
    const rows = await tx.spot.findMany({
      where: cursor
        ? {
            OR: [
              { createdAt: { lt: cursor.createdAt } },
              {
                createdAt: cursor.createdAt,
                id: { lt: cursor.id },
              },
            ],
          }
        : undefined,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: FEED_PAGE_SIZE + 1,
      select: spotSelect,
    });

    const page = rows.slice(0, FEED_PAGE_SIZE);
    const hasMore = rows.length > FEED_PAGE_SIZE;

    const placeIds = [...new Set(page.map((row) => row.placeId))];
    const savedCounts = await countSavedInCircleByPlaceIds(tx, placeIds);

    const items: FeedItemDto[] = page.map((row) => ({
      spot: toSpotDto(row, savedCounts.get(row.placeId) ?? 0),
      actor: toUserDto(row.addedByUser),
      collectionName: row.collection.name,
      createdAt: row.createdAt.toISOString(),
    }));

    const last = page.at(-1);
    return {
      items,
      nextCursor:
        hasMore && last
          ? encodeFeedCursor(last.createdAt, last.id)
          : null,
    };
  });
}
