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
assert(spotDetailSheet.includes("GoogleMapsAttribution"), "spot detail includes maps attribution");

const feedWrapper = readSource("components/home/feed-spot-detail-sheet.tsx");
assert(feedWrapper.includes("SpotDetailSheet"), "feed wrapper uses SpotDetailSheet");

const spotList = readSource("components/mypage/spot-form.tsx");
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

const heroCard = readSource("components/home/feed-hero-card.tsx");
assert(
  heroCard.includes('aria-label="スポット詳細を開く"'),
  "hero photo opens detail",
);

console.log("PASS: spot detail UI verified");
