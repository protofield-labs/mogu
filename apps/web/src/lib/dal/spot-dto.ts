import "server-only";

export type SpotDto = {
  id: string;
  placeId: string;
  addedBy: string;
  collectionId: string;
  photoUrls: string[];
  comment: string;
  rating: "again" | "either" | "no";
  structuredTags: {
    area: string | null;
    genre: string | null;
    situation: string | null;
  };
  freeTags: string[];
  savedCount: number;
  originUserId: string | null;
  createdAt: string;
};

export type SpotRow = {
  id: string;
  placeId: string;
  addedBy: string;
  collectionId: string;
  photoUrls: string[];
  comment: string;
  rating: "again" | "either" | "no";
  tagArea: string | null;
  tagGenre: string | null;
  tagSituation: string | null;
  freeTags: string[];
  originUserId: string | null;
  depth: number;
  createdAt: Date;
};

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
