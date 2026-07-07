/**
 * All-my-spots map helpers verification (#180).
 * Run via: pnpm exec tsx scripts/verify-all-my-spots.ts
 */
import { assert } from "./test-helpers/assert";

import {
  dedupeSpotsForMap,
  mergeCollectionSpots,
  pickSpotForMapPin,
} from "../src/lib/mypage/all-my-spots";
import type { Spot } from "../src/lib/spots/browser-api";

function spot(
  overrides: Partial<Spot> & Pick<Spot, "id" | "placeId">,
): Spot {
  return {
    addedBy: "me",
    collectionId: "c-1",
    photoUrls: [],
    comment: "nice",
    rating: "either",
    structuredTags: { area: null, genre: null, situation: null },
    freeTags: [],
    savedCount: 0,
    originUserId: null,
    createdAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

function main() {
  const older = spot({
    id: "s-old",
    placeId: "ChIJ1",
    rating: "either",
    createdAt: "2026-07-01T00:00:00.000Z",
  });
  const newerAgain = spot({
    id: "s-new",
    placeId: "ChIJ1",
    rating: "again",
    createdAt: "2026-07-02T00:00:00.000Z",
  });

  assert(
    pickSpotForMapPin(older, newerAgain).id === "s-new",
    "prefer stronger rating when placeId collides",
  );

  const deduped = dedupeSpotsForMap([
    older,
    newerAgain,
    spot({ id: "s-2", placeId: "ChIJ2" }),
  ]);
  assert(deduped.length === 2, "dedupe keeps one pin per placeId");
  assert(
    deduped.some((entry) => entry.id === "s-new"),
    "deduped pin keeps winning spot",
  );

  const merged = mergeCollectionSpots([
    {
      id: "c-1",
      ownerId: "me",
      name: "恵比寿",
      description: null,
      visibility: "friends",
      theme: null,
      coverUrl: null,
      autoCoverUrls: [],
      spotCount: 1,
      sortOrder: 0,
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
      spots: [spot({ id: "s-1", placeId: "ChIJ1", collectionId: "c-1" })],
    },
  ]);
  assert(merged.spots.length === 1, "merge collects spots");
  assert(merged.collectionNameBySpotId["s-1"] === "恵比寿", "merge tracks collection name");

  console.log("PASS: all-my-spots helpers verified");
}

main();
