/**
 * Deeplink + share verification (#122).
 * Run via: pnpm exec tsx scripts/verify-deeplink-share.ts
 */
import { assert } from "./test-helpers/assert";

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  collectionPath,
  spotPath,
} from "../src/lib/friends/paths";
import { flagEventHref } from "../src/lib/mypage/notifications";

const root = join(process.cwd(), "src");

function readSource(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

assert(spotPath("spot-1") === "/spots/spot-1", "spot path");
assert(collectionPath("col-1") === "/collections/col-1", "collection path");
assert(
  flagEventHref({
    id: "f1",
    spotId: "spot-1",
    collectionId: "col-1",
    placeId: "ChIJ1",
    spotComment: "nice",
    actor: null,
    isAnonymous: true,
    createdAt: new Date().toISOString(),
  }) === null,
  "anonymous flag has no deeplink",
);
assert(
  flagEventHref({
    id: "f2",
    spotId: "spot-2",
    collectionId: "col-2",
    placeId: "ChIJ2",
    spotComment: "named",
    actor: { id: "u1", displayName: "Ken", avatarColor: "#336699" },
    isAnonymous: false,
    createdAt: new Date().toISOString(),
  }) === "/spots/spot-2",
  "named flag deep link to spot",
);

assert(
  existsSync(join(root, "app/(protected)/spots/[id]/page.tsx")),
  "spot page exists",
);
assert(
  existsSync(join(root, "app/(protected)/collections/[id]/page.tsx")),
  "collection page exists",
);

const spotRoute = readSource("app/api/v1/spots/[id]/route.ts");
assert(spotRoute.includes("getSpotDetail"), "spots GET uses getSpotDetail");
assert(
  existsSync(join(root, "app/api/v1/spots/[id]/gate/route.ts")),
  "spot gate route exists",
);
assert(
  existsSync(join(root, "app/api/v1/collections/[id]/gate/route.ts")),
  "collection gate route exists",
);

const shareButton = readSource("components/share/share-button.tsx");
assert(shareButton.includes("useShare"), "ShareButton uses useShare");

const collectionView = readSource("components/mypage/collection-detail-view.tsx");
assert(collectionView.includes("ShareButton"), "collection detail has share");

const feedSheet = readSource("components/home/feed-spot-detail-sheet.tsx");
assert(feedSheet.includes("ShareButton"), "feed spot sheet has share");

const friendSpotList = readSource("components/users/friend-spot-list.tsx");
assert(friendSpotList.includes("spotPath"), "friend spot list links to spot page");

const legacyCollectionPage = readSource("app/(protected)/mypage/collections/[id]/page.tsx");
assert(legacyCollectionPage.includes("redirect("), "legacy mypage collection redirects");

console.log("PASS: deeplink + share verified");
