/**
 * Spot detail UI verification (#120 Definition of Done).
 * Run via: pnpm exec tsx scripts/verify-spot-detail-ui.ts
 */
import { assert } from "./test-helpers/assert";

import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd(), "src");

function readSource(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

const spotDetailSheet = readSource("components/spots/spot-detail-sheet.tsx");
assert(spotDetailSheet.includes("export function SpotDetailSheet"), "SpotDetailSheet exported");
assert(spotDetailSheet.includes("Sheet"), "spot detail sheet uses Sheet primitive");
assert(spotDetailSheet.includes("SpotDetailMedia"), "spot detail uses place photo fallback");
assert(spotDetailSheet.includes('variant="hero"'), "spot detail uses hero photo layout");
assert(spotDetailSheet.includes("SheetFooter"), "spot detail stacks actions in footer");
assert(spotDetailSheet.includes("distanceLabel"), "spot detail accepts distance label");
assert(spotDetailSheet.includes("place.address"), "spot detail shows place address");
assert(spotDetailSheet.includes("GoogleMapsAttribution"), "spot detail includes maps attribution");

const feedWrapper = readSource("components/home/feed-spot-detail-sheet.tsx");
assert(feedWrapper.includes("SpotDetailSheet"), "feed wrapper uses SpotDetailSheet");

const spotList = readSource("components/mypage/spot-list.tsx");
assert(spotList.includes("SpotPlaceName"), "SpotList uses SpotPlaceName");
assert(spotList.includes("onSelect"), "SpotList supports onSelect");

const collectionView = readSource("components/mypage/collection-detail-view.tsx");
assert(collectionView.includes("SpotDetailSheet"), "collection view uses SpotDetailSheet");
assert(
  collectionView.includes("formatCollectionVisibility"),
  "collection header shows visibility",
);
assert(
  collectionView.includes("エージェントに相談して最初のスポットを追加"),
  "empty state CTA to search",
);
assert(collectionView.includes('href="/search"'), "empty state links to search");

const feedItemCard = readSource("components/home/feed-item-card.tsx");
assert(
  feedItemCard.includes('aria-label="スポット詳細を開く"'),
  "feed photo opens detail",
);

console.log("PASS: spot detail UI verified");
