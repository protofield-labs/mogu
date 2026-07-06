/**
 * Home UI helpers verification (#54 Definition of Done).
 * Run via: pnpm exec tsx scripts/verify-home-ui.ts
 */
import {
  friendHasUnreadFeed,
  getLastReadFeedAt,
  isFeedItemUnread,
  markFeedRead,
  oldestFeedItemTime,
  shouldShowSoloEmptyState,
  sortFriendsForAvatarRow,
} from "../src/lib/home/feed-read";
import {
  formatRatingChip,
  formatSavedCountBadge,
  formatViaLabel,
} from "../src/lib/home/feed-labels";
import { recollectFeedSpot } from "../src/lib/home/recollect-spot";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

const friends = [
  { id: "f-ken", displayName: "Ken", avatarColor: "#336699" },
  { id: "f-aoi", displayName: "Aoi", avatarColor: "#993366" },
];

const feedItems = [
  {
    spot: {
      id: "spot-1",
      placeId: "ChIJ1",
      addedBy: "f-ken",
      collectionId: "c-1",
      photoUrls: [],
      comment: "great",
      rating: "again" as const,
      structuredTags: {},
      freeTags: [],
      savedCount: 3,
      originUserId: null,
      createdAt: "2026-07-06T12:00:00.000Z",
    },
    actor: friends[0]!,
    collectionName: "Ken shelf",
    createdAt: "2026-07-06T12:00:00.000Z",
  },
  {
    spot: {
      id: "spot-2",
      placeId: "ChIJ2",
      addedBy: "f-aoi",
      collectionId: "c-2",
      photoUrls: [],
      comment: "nice",
      rating: "either" as const,
      structuredTags: {},
      freeTags: [],
      savedCount: 1,
      originUserId: null,
      createdAt: "2026-07-05T10:00:00.000Z",
    },
    actor: friends[1]!,
    collectionName: "Aoi shelf",
    createdAt: "2026-07-05T10:00:00.000Z",
  },
];

function main() {
  const lastRead = new Date("2026-07-06T08:00:00.000Z");
  assert(isFeedItemUnread("2026-07-06T12:00:00.000Z", lastRead), "newer item unread");
  assert(!isFeedItemUnread("2026-07-05T10:00:00.000Z", lastRead), "older item read");
  assert(
    friendHasUnreadFeed("f-ken", feedItems, lastRead),
    "friend with newer item has unread ring",
  );
  assert(
    !friendHasUnreadFeed("f-aoi", feedItems, lastRead),
    "friend without newer item has no ring",
  );

  const sorted = sortFriendsForAvatarRow(friends, feedItems, lastRead);
  assert(sorted[0]?.id === "f-ken", "unread friend sorted first");

  assert(
    oldestFeedItemTime(feedItems) ===
      new Date("2026-07-05T10:00:00.000Z").getTime(),
    "oldest feed item time",
  );
  assert(
    oldestFeedItemTime([]) === Number.POSITIVE_INFINITY,
    "empty feed yields Infinity (stops ring backfill)",
  );

  assert(formatRatingChip("again") === "また行きたい", "rating chip");
  assert(formatViaLabel("Ken") === "via Ken", "via label");
  assert(formatSavedCountBadge(3) === "輪で3人", "saved badge");
  assert(formatSavedCountBadge(0) === null, "hide zero saved badge");
  assert(shouldShowSoloEmptyState(0), "solo when no friends");
  assert(!shouldShowSoloEmptyState(2), "not solo with friends");

  assert(typeof recollectFeedSpot === "function", "recollect helper exported");
  assert(typeof markFeedRead === "function", "markFeedRead exported");
  assert(typeof getLastReadFeedAt === "function", "getLastReadFeedAt exported");

  console.log("PASS: home UI helpers verified");
}

main();
