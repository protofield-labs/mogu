/** Shared Spot DTO shape (OpenAPI / API responses). */

export type SpotRating = "again" | "either" | "no";

export type SpotStructuredTags = {
  area: string | null;
  genre: string | null;
  situation: string | null;
};

export type SpotDto = {
  id: string;
  placeId: string;
  addedBy: string;
  collectionId: string;
  photoUrls: string[];
  comment: string;
  rating: SpotRating;
  structuredTags: SpotStructuredTags;
  freeTags: string[];
  savedCount: number;
  originUserId: string | null;
  createdAt: string;
};

/** Prisma spot row fields consumed by {@link toSpotDto}. */
export type SpotRow = {
  id: string;
  placeId: string;
  addedBy: string;
  collectionId: string;
  photoUrls: string[];
  comment: string;
  rating: SpotRating;
  tagArea: string | null;
  tagGenre: string | null;
  tagSituation: string | null;
  freeTags: string[];
  originUserId: string | null;
  depth: number;
  createdAt: Date;
};
