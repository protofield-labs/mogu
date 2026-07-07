/**
 * Notifications UI verification (#119 Definition of Done).
 * Run via: pnpm exec tsx scripts/verify-notifications-ui.ts
 */
import { assert } from "./test-helpers/assert";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  flagEventHref,
  formatFlagEventMessage,
  formatRelativeTime,
} from "../src/lib/mypage/notifications";
import { getNotificationHref } from "../src/lib/mypage/stats-row";

const root = join(process.cwd(), "src");

function readSource(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

assert(
  getNotificationHref({ pendingFriendRequests: 1, unreadFlags: 0 }) ===
    "/notifications",
  "notification href",
);

assert(
  formatFlagEventMessage({
    actor: { id: "u1", displayName: "Ken", avatarColor: "#336699" },
    isAnonymous: false,
  }) === "Kenさんがあなたのスポットを保存しました",
  "named flag message",
);
assert(
  formatFlagEventMessage({ actor: null, isAnonymous: true }) ===
    "誰かがあなたのスポットを保存しました",
  "anonymous flag message",
);

const fiveMinutesAgo = new Date(Date.now() - 5 * 60_000).toISOString();
assert(formatRelativeTime(fiveMinutesAgo) === "5分前", "relative time minutes");

assert(
  flagEventHref({
    id: "f1",
    spotId: "spot-1",
    collectionId: "col-1",
    placeId: "ChIJ1",
    spotComment: "nice",
    actor: null,
    isAnonymous: true,
    createdAt: fiveMinutesAgo,
  }) === "/mypage/collections/col-1?spotId=spot-1",
  "flag event deep link to collection spot",
);

const notificationsView = readSource("components/notifications/notifications-view.tsx");
assert(notificationsView.includes("markFlagsRead"), "notifications marks flags read");
assert(notificationsView.includes("IncomingFriendRequestList"), "friend requests reused");
assert(notificationsView.includes("fetchFlagEvents"), "loads flag timeline");

const homeBell = readSource("components/home/home-notification-button.tsx");
assert(homeBell.includes("getNotificationHref"), "home bell uses notification href");

const browserApi = readSource("lib/mypage/browser-api.ts");
assert(browserApi.includes("/api/v1/flags/events"), "flag events API client");

console.log("PASS: notifications UI verified");
