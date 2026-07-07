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
assert(usersRoute.includes("ensureDefaultCollection"), "onboarding seeds default shelf");

const feedDal = readSource("lib/dal/feed.ts");
assert(feedDal.includes("savedByMe"), "feed includes savedByMe");

const feedSchema = readSource("lib/api/schemas/home.ts");
assert(feedSchema.includes("savedByMe"), "feed schema includes savedByMe");

const picker = readSource("components/recollect/collection-picker-sheet.tsx");
assert(picker.includes("保存先を選ぶ"), "collection picker sheet exists");
assert(!picker.includes("棚"), "picker empty state avoids 棚");

const toast = readSource("lib/ui/recollect-toast.ts");
assert(toast.includes('"変更"'), "recollect toast has change action");

assert(
  existsSync(join(root, "components/recollect/recollect-picker.tsx")),
  "recollect picker host exists",
);

const feedHero = readSource("components/home/feed-hero-card.tsx");
assert(feedHero.includes("useRecollect"), "feed hero uses recollect hook");

const saveSpot = readSource("lib/recollect/save-spot.ts");
assert(saveSpot.includes("savedSpot.collectionId !== collectionId"), "validates idempotent target");
assert(!saveSpot.includes("棚"), "save error avoids 棚");

console.log("PASS: recollect UX verified");
