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
assert(compactRow.includes("onOpen"), "compact row opens detail sheet");
assert(!compactRow.includes("stashPendingRecommendation"), "compact row no longer jumps to chat");

const spotThumbnail = readSource("components/places/spot-thumbnail.tsx");
assert(spotThumbnail.includes("resolveSpotHeroPhoto"), "spot thumbnail uses hero photo resolver");
assert(spotThumbnail.includes("PlacePhotoImage"), "spot thumbnail falls back to place photos");
assert(spotThumbnail.includes("AuthImage"), "spot thumbnail prefers spot photos");
assert(spotThumbnail.includes("GoogleMapsAttribution"), "spot thumbnail can show maps attribution");
assert(spotThumbnail.includes("placeLoading"), "spot thumbnail supports place loading shimmer");

const feedItemCard = readSource("components/home/feed-item-card.tsx");
assert(feedItemCard.includes("SpotThumbnail"), "feed item uses spot thumbnail fallback");
assert(feedItemCard.includes("showMapsAttribution"), "feed item shows maps attribution on place photos");
assert(feedItemCard.includes("placeLoading"), "feed item waits for place photos while loading");

const spotList = readSource("components/mypage/spot-list.tsx");
assert(spotList.includes("SpotThumbnail"), "collection spot list uses SpotThumbnail (#254)");
assert(
  !spotList.includes("showMapsAttribution"),
  "size-16 collection list rows omit maps overlay (#315)",
);
assert(spotList.includes("usePlace"), "collection spot list loads place photos when needed");

const spotDetailSheet = readSource("components/spots/spot-detail-sheet.tsx");
assert(
  spotDetailSheet.includes("GoogleMapsAttribution"),
  "spot detail sheet keeps text attribution (guardrail 7)",
);

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
