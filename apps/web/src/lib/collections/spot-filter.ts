import type { SpotDto, SpotRating } from "@/lib/spot/types";

export type CollectionSpotRatingFilter = SpotRating | "all";

function spotSearchHaystack(
  spot: SpotDto,
  placeName: string | null | undefined,
): string {
  const tags = [
    spot.structuredTags.area,
    spot.structuredTags.genre,
    spot.structuredTags.situation,
    ...spot.freeTags,
    spot.comment,
    placeName,
  ];
  return tags.filter(Boolean).join(" ").toLowerCase();
}

export function filterCollectionSpots(
  spots: SpotDto[],
  query: string,
  ratingFilter: CollectionSpotRatingFilter,
  placeNames: Record<string, string | null | undefined>,
): SpotDto[] {
  const normalizedQuery = query.trim().toLowerCase();

  return spots.filter((spot) => {
    if (ratingFilter !== "all" && spot.rating !== ratingFilter) {
      return false;
    }
    if (!normalizedQuery) {
      return true;
    }
    return spotSearchHaystack(spot, placeNames[spot.placeId]).includes(
      normalizedQuery,
    );
  });
}
