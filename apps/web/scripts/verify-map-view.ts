/**
 * Map view UI verification (#130 Definition of Done).
 * Run via: pnpm exec tsx scripts/verify-map-view.ts
 */
import { assert } from "./test-helpers/assert";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  decodeMapMarkerKey,
  encodeMapMarkerKey,
} from "../src/lib/places/map-marker-points";

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
assert(mapView.includes("MapApiProvider"), "map view uses map api provider");
assert(mapView.includes("mapPinIcon"), "map pins use rating-specific icons");
assert(mapView.includes("CollectionSpotMapCard"), "map view shows mini card");
assert(mapView.includes("points={markerPoints}"), "map viewport receives coordinate points");

const markerKey = encodeMapMarkerKey([
  { lat: 35.658, lng: 139.701 },
  { lat: 35.659, lng: 139.702 },
]);
assert(markerKey.includes("35.658,139.701"), "marker key encodes coordinates");
assert(decodeMapMarkerKey(markerKey).length === 2, "marker key decodes coordinates");

const mapPinIcon = readSource("lib/collections/map-pin-icon.ts");
assert(mapPinIcon.includes("ratingPinColor"), "map pins use rating colors");
assert(mapPinIcon.includes("anchor"), "map pins set bottom anchor");
assert(!mapPinIcon.includes("heartIcon"), "map pins avoid heart glyphs");

const locationsRoute = readSource("app/api/v1/places/locations/route.ts");
assert(locationsRoute.includes("fetchPlaceLocations"), "locations route resolves coordinates");

const placesClient = readSource("lib/places/google-places-client.ts");
assert(placesClient.includes("location"), "places client requests coordinates");

const mypageMapPage = readSource("app/(protected)/mypage/map/page.tsx");
assert(mypageMapPage.includes("MypageAllSpotsMapView"), "mypage map page exists");

const mypageMapView = readSource("components/mypage/mypage-all-spots-map-view.tsx");
assert(mypageMapView.includes("CollectionSpotMapView"), "mypage map view reuses map component");
assert(mypageMapView.includes("loadAllMySpots"), "mypage map loads all spots");

const mypageView = readSource("components/mypage/mypage-view.tsx");
assert(mypageView.includes('href="/mypage/map"'), "mypage links to cross-collection map");

const allMySpots = readSource("lib/mypage/all-my-spots.ts");
assert(allMySpots.includes("dedupeSpotsForMap"), "all-my-spots dedupes map pins");

const homeFeedMapView = readSource("components/home/home-feed-map-view.tsx");
assert(homeFeedMapView.includes("CollectionSpotMapView"), "home feed map reuses map component");
assert(homeFeedMapView.includes("showNearbyList={false}"), "home feed map skips nearby list");
assert(
  homeFeedMapView.includes('mapClassName="h-[min(55dvh,520px)] w-full"'),
  "home feed map uses explicit height (not min-h only) for Maps JS tiles",
);

const mypageMapSizing = readSource("components/mypage/mypage-all-spots-map-view.tsx");
assert(
  mypageMapSizing.includes('mapClassName="h-[min(70dvh,640px)] w-full"'),
  "mypage map uses explicit height (not min-h only) for Maps JS tiles",
);

console.log("PASS: map view UI verified");
