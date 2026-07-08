import "server-only";

import { withAuthRls } from "@/lib/auth/with-auth-rls";
import { countSavedInCircleByPlaceIds, listSavedInCircleByPlaceIds } from "@/lib/dal/saved-count";
import { getSavedSourceSpotIds } from "@/lib/dal/recollect-state";
import {
  countLikesInCircleBySpotIds,
  getLikedSpotIds,
} from "@/lib/dal/spot-likes";
import { toSpotDto, type SpotDto } from "@/lib/dal/spot-dto";
import { toUserDto, type UserDto } from "@/lib/dal/users";
import { decodeFeedCursor, encodeFeedCursor } from "@/lib/feed/cursor";

export { decodeFeedCursor, encodeFeedCursor } from "@/lib/feed/cursor";
export type FeedItemDto = {
  spot: SpotDto;
  actor: UserDto;
  collectionName: string;
  createdAt: string;
  savedByMe: boolean;
  savedSavers: UserDto[];
  likeCount: number;
  likedByMe: boolean;
};

export type FeedPageDto = {
  items: FeedItemDto[];
  nextCursor: string | null;
};

const FEED_PAGE_SIZE = 20;

type FeedCursor = { createdAt: Date; id: string };

/** Exclude viewer's own spots when they have friends (spec: feed = circle activity). */
function buildFeedWhere(
  uid: string,
  excludeOwnSpots: boolean,
  cursor?: FeedCursor,
) {
  const ownFilter = excludeOwnSpots ? { addedBy: { not: uid } } : undefined;
  const cursorFilter = cursor
    ? {
        OR: [
          { createdAt: { lt: cursor.createdAt } },
          {
            createdAt: cursor.createdAt,
            id: { lt: cursor.id },
          },
        ],
      }
    : undefined;

  if (ownFilter && cursorFilter) {
    return { AND: [ownFilter, cursorFilter] };
  }
  return ownFilter ?? cursorFilter;
}

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
    const friendCount = await tx.friendship.count({
      where: {
        status: "accepted",
        OR: [{ userLow: uid }, { userHigh: uid }],
      },
    });
    const excludeOwnSpots = friendCount > 0;

    const rows = await tx.spot.findMany({
      where: buildFeedWhere(uid, excludeOwnSpots, cursor),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: FEED_PAGE_SIZE + 1,
      select: spotSelect,
    });

    const page = rows.slice(0, FEED_PAGE_SIZE);
    const hasMore = rows.length > FEED_PAGE_SIZE;

    const placeIds = [...new Set(page.map((row) => row.placeId))];
    const savedCounts = await countSavedInCircleByPlaceIds(tx, placeIds);
    const savedSaversByPlace = await listSavedInCircleByPlaceIds(tx, placeIds);
    const spotIds = page.map((row) => row.id);
    const likeCounts = await countLikesInCircleBySpotIds(tx, spotIds);
    const likedSpotIds = await getLikedSpotIds(tx, uid, spotIds);
    const savedSourceIds = await getSavedSourceSpotIds(
      tx,
      uid,
      spotIds,
    );

    const items: FeedItemDto[] = page.map((row) => ({
      spot: toSpotDto(row, savedCounts.get(row.placeId) ?? 0),
      actor: toUserDto(row.addedByUser),
      collectionName: row.collection.name,
      createdAt: row.createdAt.toISOString(),
      savedByMe: savedSourceIds.has(row.id),
      savedSavers: savedSaversByPlace.get(row.placeId) ?? [],
      likeCount: likeCounts.get(row.id) ?? 0,
      likedByMe: likedSpotIds.has(row.id),
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
