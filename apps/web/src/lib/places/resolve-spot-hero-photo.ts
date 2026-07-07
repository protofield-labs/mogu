import type { PlacePhotoAttribution } from "@/lib/places/types";

type SpotWithPhotos = {
  photoUrls: string[];
};

type PlaceWithPhotos = {
  photos: Array<{ url: string; authorAttributions: PlacePhotoAttribution[] }>;
};

export type SpotHeroPhoto =
  | { source: "spot"; url: string }
  | {
      source: "place";
      url: string;
      authorAttributions: PlacePhotoAttribution[];
    };

export function resolveSpotHeroPhoto(
  spot: SpotWithPhotos,
  place: PlaceWithPhotos | null | undefined,
): SpotHeroPhoto | null {
  const spotPhoto = spot.photoUrls[0];
  if (spotPhoto) {
    return { source: "spot", url: spotPhoto };
  }

  const placePhoto = place?.photos[0];
  if (placePhoto) {
    return {
      source: "place",
      url: placePhoto.url,
      authorAttributions: placePhoto.authorAttributions,
    };
  }

  return null;
}
