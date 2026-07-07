/**
 * Collection cover / spot filter verification (#121).
 * Run via: pnpm exec tsx scripts/verify-collection-ui.ts
 */
import { assert } from "./test-helpers/assert";

import {
  pickAutoCoverUrls,
  resolveDisplayCoverUrl,
} from "../src/lib/collections/cover";
import { filterCollectionSpots } from "../src/lib/collections/spot-filter";
import type { SpotDto } from "../src/lib/spot/types";

const sampleSpot = (overrides: Partial<SpotDto> = {}): SpotDto => ({
  id: "spot-1",
  placeId: "ChIJ1",
  addedBy: "user-1",
  collectionId: "col-1",
  photoUrls: [],
  comment: "静かなカウンター",
  rating: "again",
  structuredTags: {
    area: "恵比寿",
    genre: "和食",
    situation: "デート",
  },
  freeTags: ["個室"],
  savedCount: 0,
  originUserId: null,
  createdAt: "2026-07-07T00:00:00.000Z",
  ...overrides,
});

function main() {
  assert(
    pickAutoCoverUrls([
      { photoUrls: ["https://a/1.jpg", "https://a/2.jpg"] },
      { photoUrls: ["https://a/2.jpg", "https://a/3.jpg"] },
    ]).join(",") === "https://a/1.jpg,https://a/2.jpg,https://a/3.jpg",
    "auto cover picks distinct urls in order",
  );
  assert(
    resolveDisplayCoverUrl({
      coverUrl: "https://a/manual.jpg",
      autoCoverUrls: ["https://a/auto.jpg"],
    }) === "https://a/manual.jpg",
    "manual cover wins",
  );
  assert(
    resolveDisplayCoverUrl({
      coverUrl: null,
      autoCoverUrls: ["https://a/auto.jpg"],
    }) === "https://a/auto.jpg",
    "auto cover fallback",
  );

  const spots = [
    sampleSpot({ id: "s1", placeId: "ChIJ1", comment: "静かなカウンター", rating: "again" }),
    sampleSpot({ id: "s2", placeId: "ChIJ2", comment: "にぎやか", rating: "no" }),
  ];
  assert(
    filterCollectionSpots(spots, "恵比寿", "all", { ChIJ1: "恵比寿バー" }).length ===
      2,
    "area tag matches search",
  );
  assert(
    filterCollectionSpots(spots, "", "no", {}).length === 1,
    "rating filter only",
  );
  assert(
    filterCollectionSpots(spots, "バー", "all", { ChIJ1: "恵比寿バー" }).length ===
      1,
    "place name matches search",
  );

  console.log("PASS: collection ui helpers");
}

main();
