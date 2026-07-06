/**
 * Mypage UI helpers verification (#56 Definition of Done).
 * Run via: pnpm exec tsx scripts/verify-mypage-ui.ts
 */
import {
  formatAnonymousFlagLine,
  formatNamedFlagLine,
  formatWeeklyHeadline,
  getUtcWeekStart,
  pickWeekNotifications,
  shouldShowFlagInbox,
  summarizeWeeklyFlags,
} from "../src/lib/mypage/flag-inbox";
import {
  formatStatsRow,
  getNotificationHref,
  shouldShowFriendRequestBadge,
  shouldShowMypageTabBadge,
} from "../src/lib/mypage/stats-row";
import {
  findDuplicateDisplayNames,
  formatAvatarColorLabel,
  formatFriendRequestError,
  isIncomingPending,
} from "../src/lib/mypage/friend-request-ui";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function main() {
  const weekOf = "2026-07-06";
  const notifications = [
    {
      type: "recollected" as const,
      count: 1,
      isAnonymous: false,
      weekOf,
    },
    {
      type: "recollected" as const,
      count: 2,
      isAnonymous: true,
      weekOf,
    },
    {
      type: "recollected" as const,
      count: 5,
      isAnonymous: false,
      weekOf: "2026-06-30",
    },
  ];

  assert(getUtcWeekStart(new Date("2026-07-08T12:00:00Z")) === weekOf, "week start");
  assert(pickWeekNotifications(notifications, weekOf).length === 2, "week filter");

  const summary = summarizeWeeklyFlags(notifications, weekOf);
  assert(summary.totalCount === 3, "weekly total");
  assert(summary.namedCount === 1, "named total");
  assert(summary.anonymousCount === 2, "anonymous total");
  assert(shouldShowFlagInbox(summary), "show inbox when flags exist");
  assert(
    formatWeeklyHeadline(summary.totalCount) === "今週、スポットが3回保存されました",
    "weekly headline",
  );
  assert(formatNamedFlagLine(1) === "保存されました", "named line singular");
  assert(formatAnonymousFlagLine(2) === "誰かが保存しました ×2", "anonymous line plural");
  assert(!shouldShowFlagInbox(summarizeWeeklyFlags([], weekOf)), "hide empty inbox");

  const stats = formatStatsRow({ collections: 6, spots: 41, friends: 3 });
  assert(stats.collectionsLabel === "6 コレクション", "collections label");
  assert(stats.spotsLabel === "41 スポット", "spots label");
  assert(stats.friendsLabel === "3 友達", "friends label");

  assert(shouldShowFriendRequestBadge(1), "friend badge when pending");
  assert(!shouldShowFriendRequestBadge(0), "no friend badge when clear");
  assert(
    shouldShowMypageTabBadge({ pendingFriendRequests: 0, unreadFlags: 2 }),
    "tab badge for unread flags",
  );
  assert(
    !shouldShowMypageTabBadge({ pendingFriendRequests: 0, unreadFlags: 0 }),
    "no tab badge when clear",
  );
  assert(
    getNotificationHref({ pendingFriendRequests: 2, unreadFlags: 1 }) ===
      "/mypage/friends",
    "bell links to friends when requests pending",
  );
  assert(
    getNotificationHref({ pendingFriendRequests: 0, unreadFlags: 3 }) ===
      "/mypage",
    "bell links to mypage for flag inbox when no requests",
  );

  assert(
    formatFriendRequestError(
      new Error("すでに申請済みです"),
      "fallback",
    ) === "すでに申請済みです",
    "localized error passthrough",
  );
  const duplicates = findDuplicateDisplayNames([
    { id: "1", displayName: "dev", avatarColor: "#2563EB" },
    { id: "2", displayName: "dev", avatarColor: "#DC2626" },
    { id: "3", displayName: "Ken", avatarColor: "#059669" },
  ]);
  assert(duplicates.has("dev") && !duplicates.has("Ken"), "duplicate names");
  assert(formatAvatarColorLabel("#2563EB") === "ブルー", "avatar color label");
  assert(isIncomingPending("u1", new Set(["u1"])), "incoming pending");

  console.log("PASS: mypage UI helpers verified");
}

main();
