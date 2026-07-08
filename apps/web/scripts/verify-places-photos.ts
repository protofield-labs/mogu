/**
 * Place Photos verification (#161 / guardrail 7).
 * Run via: pnpm exec tsx scripts/verify-places-photos.ts
 */
import { assert } from "./test-helpers/assert";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { resolveSpotHeroPhoto } from "../src/lib/places/resolve-spot-hero-photo";

const root = join(process.cwd(), "src");

function readSource(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

const placesClient = readSource("lib/places/google-places-client.ts");
assert(placesClient.includes("languageCode"), "places client requests Japanese labels");
assert(
  placesClient.includes("PLACES_LANGUAGE_CODE"),
  "places client pins language to ja",
);
assert(placesClient.includes("mapPhotos"), "places client maps photo metadata");
assert(
  placesClient.includes("fetchPlacePhotoMedia"),
  "places client streams photo media",
);

const photoRoute = readSource("app/api/v1/places/[placeId]/photos/[index]/route.ts");
assert(photoRoute.includes("fetchPlacePhotoMedia"), "photo route proxies media");

const spotDetailMedia = readSource("components/spots/spot-detail-media.tsx");
assert(spotDetailMedia.includes("PlacePhotoImage"), "spot detail media uses place photos");
assert(
  spotDetailMedia.includes("authorAttributions"),
  "spot detail media attributes each place photo",
);

const recommendationCard = readSource("components/search/recommendation-card.tsx");
assert(
  recommendationCard.includes("resolveSpotHeroPhoto"),
  "recommendation card resolves hero photo",
);
assert(
  recommendationCard.includes("PlacePhotoImage"),
  "recommendation card uses place photo fallback",
);

const compactRow = readSource("components/home/recommendation-compact-row.tsx");
assert(
  compactRow.includes("HOME_RECOMMENDATION_LABEL"),
  "compact row uses updated recommendation label",
);
assert(compactRow.includes("evidence"), "compact row shows evidence");

const spotThumbnail = readSource("components/places/spot-thumbnail.tsx");
assert(spotThumbnail.includes("resolveSpotHeroPhoto"), "spot thumbnail uses hero photo resolver");
assert(spotThumbnail.includes("PlacePhotoImage"), "spot thumbnail falls back to place photos");
assert(spotThumbnail.includes("AuthImage"), "spot thumbnail prefers spot photos");
assert(spotThumbnail.includes("GoogleMapsAttribution"), "spot thumbnail can show maps attribution");
assert(spotThumbnail.includes("placeLoading"), "spot thumbnail supports place loading shimmer");

const feedHero = readSource("components/home/feed-hero-card.tsx");
assert(feedHero.includes("SpotThumbnail"), "feed hero uses spot thumbnail fallback");
assert(feedHero.includes("showMapsAttribution"), "feed hero shows maps attribution on place photos");
assert(feedHero.includes("placeLoading"), "feed hero waits for place photos while loading");

const feedCompact = readSource("components/home/feed-compact-row.tsx");
assert(feedCompact.includes("SpotThumbnail"), "feed compact uses spot thumbnail");

assert(
  resolveSpotHeroPhoto({ photoUrls: ["gs://x/a.jpg"] }, { photos: [{ url: "/p/0", authorAttributions: [] }] })
    ?.source === "spot",
  "spot photo wins over place photo",
);
assert(
  resolveSpotHeroPhoto({ photoUrls: [] }, { photos: [{ url: "/p/0", authorAttributions: [] }] })
    ?.source === "place",
  "place photo used when spot has none",
);
assert(
  resolveSpotHeroPhoto({ photoUrls: [] }, { photos: [] }) === null,
  "null when no photos available",
);

console.log("PASS: place photos verified");
