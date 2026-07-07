/**
 * Home UI helpers verification (#54 Definition of Done).
 * Run via: pnpm exec tsx scripts/verify-home-ui.ts
 */
import { assert } from "./test-helpers/assert";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  filterFeedByActor,
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
  formatSpotTagChips,
  formatViaLabel,
} from "../src/lib/home/feed-labels";
import {
  HOME_RECOMMENDATION_LABEL,
  HOME_RECOMMENDATION_LOAD_ERROR,
} from "../src/lib/home/recommendation-labels";
import { saveSpotToCollection } from "../src/lib/recollect/save-spot";

const root = join(process.cwd(), "src");

function readSource(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
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
      structuredTags: { area: null, genre: null, situation: null },
      freeTags: [],
      savedCount: 3,
      originUserId: null,
      createdAt: "2026-07-06T12:00:00.000Z",
    },
    actor: friends[0]!,
    collectionName: "Ken collection",
    createdAt: "2026-07-06T12:00:00.000Z",
    savedByMe: false,
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
      structuredTags: { area: null, genre: null, situation: null },
      freeTags: [],
      savedCount: 1,
      originUserId: null,
      createdAt: "2026-07-05T10:00:00.000Z",
    },
    actor: friends[1]!,
    collectionName: "Aoi collection",
    createdAt: "2026-07-05T10:00:00.000Z",
    savedByMe: true,
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
  assert(
    formatSpotTagChips({
      ...feedItems[0]!.spot,
      structuredTags: { area: "恵比寿", genre: "イタリアン", situation: null },
      freeTags: ["静か"],
    }).join(",") === "恵比寿,イタリアン,静か",
    "spot tag chips",
  );
  assert(shouldShowSoloEmptyState(0), "solo when no friends");
  assert(!shouldShowSoloEmptyState(2), "not solo with friends");

  const kenOnly = filterFeedByActor(feedItems, "f-ken");
  assert(kenOnly.length === 1 && kenOnly[0]?.actor.id === "f-ken", "feed filter by actor");
  assert(filterFeedByActor(feedItems, null).length === 2, "null filter keeps all");

  assert(typeof saveSpotToCollection === "function", "save spot helper exported");
  assert(typeof markFeedRead === "function", "markFeedRead exported");
  assert(typeof getLastReadFeedAt === "function", "getLastReadFeedAt exported");
  assert(HOME_RECOMMENDATION_LABEL === "おすすめ！", "home recommendation label");
  assert(
    HOME_RECOMMENDATION_LOAD_ERROR.includes("おすすめ！"),
    "home recommendation load error copy",
  );

  const avatarRow = readSource("components/home/avatar-row.tsx");
  assert(avatarRow.includes("shrink-0"), "avatar row resists flex shrink");
  assert(
    readSource("components/home/recommendation-empty-row.tsx").includes("shrink-0"),
    "recommendation empty row resists flex shrink",
  );

  console.log("PASS: home UI helpers verified");
}

main();
