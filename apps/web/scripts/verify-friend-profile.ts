/**
 * Friend profile routes verification (#116).
 * Run via: pnpm exec tsx scripts/verify-friend-profile.ts
 */
import { assert } from "./test-helpers/assert";

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { userIdRouteParamsSchema } from "../src/lib/api/route-schemas";
import {
  actorProfilePath,
  friendCollectionPath,
  friendProfilePath,
} from "../src/lib/friends/paths";

const root = join(process.cwd(), "src");

function readSource(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

assert(
  friendProfilePath("uid-123") === "/users/uid-123",
  "friend profile path",
);
assert(
  friendCollectionPath("uid-123", "col-456") ===
    "/users/uid-123/collections/col-456",
  "friend collection path",
);
assert(actorProfilePath("uid-123", "uid-123") === "/mypage", "own actor links to mypage");
assert(
  actorProfilePath("uid-friend", "uid-123") === "/users/uid-friend",
  "friend actor links to profile",
);
assert(userIdRouteParamsSchema.safeParse({ id: "firebase-uid" }).success, "user id route param");
assert(userIdRouteParamsSchema.safeParse({ id: "" }).success === false, "user id rejects empty");

const userRoute = readSource("app/api/v1/users/[id]/route.ts");
assert(userRoute.includes("getFriendProfile"), "users/[id] uses getFriendProfile");
assert(userRoute.includes("parseRouteParams"), "users/[id] uses parseRouteParams");

const avatarRow = readSource("components/home/avatar-row.tsx");
assert(avatarRow.includes("onSelectFriend"), "avatar row filters feed by friend");

const friendsView = readSource("components/mypage/friends-view.tsx");
assert(friendsView.includes("friendProfilePath"), "friends view links to friend profile");

const feedHero = readSource("components/home/feed-hero-card.tsx");
assert(feedHero.includes("actorProfilePath"), "feed hero links actor profile");

const feedCompact = readSource("components/home/feed-compact-row.tsx");
assert(feedCompact.includes("actorProfilePath"), "feed compact links actor profile");

const friendCollectionView = readSource("components/users/friend-collection-detail-view.tsx");
assert(
  friendCollectionView.includes("detail.ownerId !== ownerId"),
  "friend collection validates URL owner",
);

assert(
  existsSync(join(root, "app/(protected)/users/[id]/page.tsx")),
  "friend profile page exists",
);
assert(
  existsSync(join(root, "app/(protected)/users/[id]/collections/[collectionId]/page.tsx")),
  "friend collection page exists",
);

console.log("PASS: friend profile routes verified");
