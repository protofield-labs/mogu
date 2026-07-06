import type { SpotDto, SpotRow } from "@/lib/spot/types";

/** Map a DB spot row to API DTO; depth >= 2 hides originUserId (#109). */
export function toSpotDto(spot: SpotRow, savedCount: number): SpotDto {
  return {
    id: spot.id,
    placeId: spot.placeId,
    addedBy: spot.addedBy,
    collectionId: spot.collectionId,
    photoUrls: spot.photoUrls,
    comment: spot.comment,
    rating: spot.rating,
    structuredTags: {
      area: spot.tagArea,
      genre: spot.tagGenre,
      situation: spot.tagSituation,
    },
    freeTags: spot.freeTags,
    savedCount,
    originUserId: spot.depth >= 2 ? null : spot.originUserId,
    createdAt: spot.createdAt.toISOString(),
  };
}
