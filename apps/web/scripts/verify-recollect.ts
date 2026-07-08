/**
 * Recollect UX helpers verification (#117).
 * Run via: pnpm exec tsx scripts/verify-recollect.ts
 */
import { assert } from "./test-helpers/assert";

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { DEFAULT_COLLECTION_NAME } from "../src/lib/recollect/constants";

const root = join(process.cwd(), "src");

function readSource(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

assert(DEFAULT_COLLECTION_NAME === "行きたいところ", "default collection name");

const lastTarget = readSource("lib/recollect/last-target.ts");
assert(lastTarget.includes("mogu:lastRecollectTarget"), "last target storage key");

const usersRoute = readSource("app/api/v1/users/route.ts");
assert(usersRoute.includes("ensureDefaultCollection"), "onboarding seeds default collection");

const feedDal = readSource("lib/dal/feed.ts");
assert(feedDal.includes("savedByMe"), "feed includes savedByMe");
assert(feedDal.includes("savedSavers"), "feed includes saved savers preview");
assert(feedDal.includes("likeCount"), "feed includes likeCount");
assert(feedDal.includes("likedByMe"), "feed includes likedByMe");
assert(feedDal.includes("excludeOwnSpots"), "feed excludes own spots when viewer has friends");
assert(feedDal.includes("buildFeedWhere"), "feed where builder centralizes filters");

const spotsDal = readSource("lib/dal/spots.ts");
assert(
  spotsDal.includes("source.addedBy === uid"),
  "recollect rejects self-owned source spots",
);

const feedSchema = readSource("lib/api/schemas/home.ts");
assert(feedSchema.includes("savedByMe"), "feed schema includes savedByMe");
assert(feedSchema.includes("savedSavers"), "feed schema includes savedSavers");
assert(feedSchema.includes("likeCount"), "feed schema includes likeCount");
assert(feedSchema.includes("likedByMe"), "feed schema includes likedByMe");

const picker = readSource("components/recollect/collection-picker-sheet.tsx");
assert(picker.includes("保存先を選ぶ"), "collection picker sheet exists");
assert(picker.includes("Sheet"), "collection picker uses Sheet primitive");
assert(!picker.includes("棚"), "picker empty state avoids 棚");

const toast = readSource("lib/ui/recollect-toast.ts");
assert(toast.includes('"変更"'), "recollect toast has change action");

assert(
  existsSync(join(root, "components/recollect/recollect-picker.tsx")),
  "recollect picker host exists",
);

const feedItemCard = readSource("components/home/feed-item-card.tsx");
assert(feedItemCard.includes("useFeedSpotSave"), "feed item uses feed spot save hook");

const saveSpot = readSource("lib/recollect/save-spot.ts");
assert(saveSpot.includes("@/lib/spots/browser-api"), "save spot uses spots browser api");
assert(saveSpot.includes("result.error"), "save spot surfaces recollect errors");
assert(saveSpot.includes("result.spot.collectionId !== collectionId"), "validates idempotent target");
assert(!saveSpot.includes("棚"), "save error avoids 棚");

const spotsApi = readSource("lib/spots/browser-api.ts");
assert(spotsApi.includes("RecollectSpotResult"), "recollect spot result type exported");
assert(spotsApi.includes("readApiErrorResponse"), "recollect spot reads api errors");

const agentApi = readSource("lib/agent/browser-api.ts");
assert(!agentApi.includes("recollectSpot"), "recollect spot removed from agent api");

const defaultCollection = readSource("lib/recollect/recollect-to-default-collection.ts");
assert(defaultCollection.includes("pickDefaultCollection"), "default collection picker helper");
assert(defaultCollection.includes("saveSpotToDefaultCollection"), "default collection save helper");

console.log("PASS: recollect UX verified");
