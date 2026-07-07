/**
 * Friends UI verification (#123 Definition of Done).
 * Run via: pnpm exec tsx scripts/verify-friends-ui.ts
 */
import { assert } from "./test-helpers/assert";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { friendshipPairIdFromUserIds } from "../src/lib/friends/pair-id";

const root = join(process.cwd(), "src");

function readSource(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

const friendsView = readSource("components/mypage/friends-view.tsx");
assert(friendsView.includes("friendsBackNavigation"), "friends view resolves contextual back link");
assert(friendsView.includes("fromHome"), "friends view accepts home entry context");
assert(friendsView.includes("cancelFriendRequest"), "friends view cancels outgoing requests");
assert(friendsView.includes("removeFriend"), "friends view removes friends");
assert(friendsView.includes("ConfirmDialog"), "friends view uses confirm dialog for unfriend");
assert(friendsView.includes("取り消す"), "friends view cancel label");
assert(
  !friendsView.includes("fetchFriendCollectionCount"),
  "friends view uses bundled collectionCount",
);

const avatarRow = readSource("components/home/avatar-row.tsx");
assert(avatarRow.includes("friendsPagePath"), "avatar row links to friends with entry context");
assert(avatarRow.includes("onSelectFriend"), "avatar row selects friend for feed filter");
assert(avatarRow.includes("FeedFilterChip"), "feed filter chip component exists");
assert(avatarRow.includes("aria-pressed"), "avatar row exposes selection state");

const homeView = readSource("components/home/home-view.tsx");
assert(homeView.includes("filterFeedByActor"), "home view filters feed by actor");
assert(homeView.includes("FeedFilterChip"), "home view shows filter chip");

const homeEmptyState = readSource("components/home/home-empty-state.tsx");
assert(
  homeEmptyState.includes("friendsPagePath"),
  "home empty state links to friends with home entry context",
);

const friendsPaths = readSource("lib/friends/paths.ts");
assert(friendsPaths.includes("friendsBackNavigation"), "friends path helpers exist");
assert(
  friendsPaths.includes("friendProfilePathWithContext"),
  "friend profile path preserves entry context",
);

const browserApi = readSource("lib/mypage/browser-api.ts");
assert(browserApi.includes('method: "DELETE"'), "browser api supports friend DELETE");
assert(
  browserApi.includes("friendListItemListSchema"),
  "friends api validates collectionCount in list response",
);
assert(
  !browserApi.includes("fetchFriendCollectionCount"),
  "friends list no longer fetches collections per friend",
);

const friendsDal = readSource("lib/dal/friends.ts");
assert(friendsDal.includes("collection.groupBy"), "friends dal batches collection counts");

const pairId = friendshipPairIdFromUserIds("user-a", "user-b");
assert(typeof pairId === "string" && pairId.length > 0, "pair id encodes from user ids");

console.log("PASS: friends UI verified");
