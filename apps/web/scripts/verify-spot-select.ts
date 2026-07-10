/**
 * Shared Prisma spot select shapes (#297).
 * Run via: pnpm exec tsx scripts/verify-spot-select.ts
 */
import { assert } from "./test-helpers/assert";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  spotCoreSelect,
  spotFeedSelect,
} from "../src/lib/dal/spot-select";

function main() {
  assert(spotCoreSelect.id === true, "spotCoreSelect includes id");
  assert(spotFeedSelect.collection.select.name === true, "spotFeedSelect includes collection name");
  assert(
    spotFeedSelect.addedByUser.select.displayName === true,
    "spotFeedSelect includes addedByUser",
  );

  const root = join(process.cwd());
  const nextConfig = readFileSync(join(root, "next.config.ts"), "utf8");
  assert(
    nextConfig.includes('optimizePackageImports: ["lucide-react"]'),
    "next.config enables lucide-react optimizePackageImports",
  );

  const feed = readFileSync(join(root, "src/lib/dal/feed.ts"), "utf8");
  const recommendations = readFileSync(
    join(root, "src/lib/dal/recommendations.ts"),
    "utf8",
  );
  assert(feed.includes("spotFeedSelect"), "feed uses spotFeedSelect");
  assert(recommendations.includes("spotCoreSelect"), "recommendations uses spotCoreSelect");
  assert(!feed.includes("const spotSelect"), "feed no longer defines local spotSelect");

  console.log("PASS: spot select shapes verified");
}

main();
