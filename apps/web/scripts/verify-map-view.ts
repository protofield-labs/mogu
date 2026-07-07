/**
 * Map view UI verification (#130 Definition of Done).
 * Run via: pnpm exec tsx scripts/verify-map-view.ts
 */
import { assert } from "./test-helpers/assert";

import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd(), "src");

function readSource(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

const collectionView = readSource("components/mypage/collection-detail-view.tsx");
assert(
  collectionView.includes("CollectionSpotViewTabs"),
  "collection detail includes list/map tabs",
);
assert(
  collectionView.includes("CollectionSpotMapView"),
  "collection detail includes map view",
);

const friendCollectionView = readSource("components/users/friend-collection-detail-view.tsx");
assert(
  friendCollectionView.includes("CollectionSpotViewTabs"),
  "friend collection detail includes list/map tabs",
);
assert(
  friendCollectionView.includes("CollectionSpotMapView"),
  "friend collection detail includes map view",
);

const mapView = readSource("components/collections/collection-spot-map-view.tsx");
assert(mapView.includes("@vis.gl/react-google-maps"), "map view uses react-google-maps");
assert(mapView.includes("ratingPinColor"), "map pins use rating colors");
assert(mapView.includes("CollectionSpotMapCard"), "map view shows mini card");

const locationsRoute = readSource("app/api/v1/places/locations/route.ts");
assert(locationsRoute.includes("fetchPlaceLocations"), "locations route resolves coordinates");

const placesClient = readSource("lib/places/google-places-client.ts");
assert(placesClient.includes("location"), "places client requests coordinates");

console.log("PASS: map view UI verified");
