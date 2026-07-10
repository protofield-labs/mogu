/**
 * Google Maps link helpers verification (#296).
 * Run via: pnpm exec tsx scripts/verify-maps-links.ts
 */
import { assert } from "./test-helpers/assert";

import {
  googleMapsPlaceUrl,
  openNowLabel,
} from "../src/lib/places/maps-links";

function main() {
  assert(
    googleMapsPlaceUrl("ChIJ123").includes("destination_place_id=ChIJ123"),
    "maps url uses destination place id",
  );
  assert(
    googleMapsPlaceUrl({
      placeId: "ChIJ123",
      name: "テスト店",
    }).includes("destination="),
    "maps url includes destination label",
  );
  assert(openNowLabel(true) === "営業中", "open now label");
  assert(openNowLabel(false) === "営業時間外", "closed label");
  assert(openNowLabel(undefined) === null, "unknown open now");

  console.log("PASS: maps links verified");
}

main();
