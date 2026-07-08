/**
 * Geolocation + distance helpers verification (#181).
 * Run via: pnpm exec tsx scripts/verify-map-geolocation.ts
 */
import { assert } from "./test-helpers/assert";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  formatDistanceMeters,
  haversineMeters,
  sortSpotsByDistance,
  spotDistanceLabels,
} from "../src/lib/places/geo";

const root = join(process.cwd(), "src");

function readSource(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

function main() {
  const tokyo = { lat: 35.6812, lng: 139.7671 };
  const shibuya = { lat: 35.658, lng: 139.7016 };
  const distance = haversineMeters(tokyo, shibuya);
  assert(distance > 5000 && distance < 7000, "haversine tokyo-shibuya range");
  assert(formatDistanceMeters(450) === "450m", "format meters");
  assert(formatDistanceMeters(1500) === "1.5km", "format kilometers");

  const spots = [
    { id: "far", placeId: "p-far" },
    { id: "near", placeId: "p-near" },
  ];
  const locations = {
    "p-far": { lat: 35.7, lng: 139.8 },
    "p-near": { lat: 35.6813, lng: 139.7672 },
  };
  const sorted = sortSpotsByDistance(spots, tokyo, locations);
  assert(sorted[0]?.id === "near", "sort spots by distance");
  assert(
    sortSpotsByDistance(spots, null, locations)[0]?.id === "far",
    "null origin preserves order",
  );

  const labels = spotDistanceLabels(spots, tokyo, locations);
  assert(typeof labels.near === "string", "distance labels generated");

  const mapView = readSource("components/collections/collection-spot-map-view.tsx");
  assert(mapView.includes("useUserLocation"), "map view uses user location hook");
  assert(mapView.includes("MapCurrentLocationButton"), "map view has current location FAB");
  assert(mapView.includes("MapNearbySpotList"), "map view shows nearby list");

  const collectionDetail = readSource("components/mypage/collection-detail-view.tsx");
  assert(collectionDetail.includes("useUserLocation"), "collection detail uses user location");
  assert(collectionDetail.includes("現在地から近い順"), "collection detail has nearby sort control");
  assert(collectionDetail.includes("CollectionCoverPicker"), "collection detail edits cover");
  assert(collectionDetail.includes("再試行"), "collection detail offers geolocation retry");

  console.log("PASS: map geolocation verified");
}

main();
