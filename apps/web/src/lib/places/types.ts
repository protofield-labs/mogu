/** OpenAPI PlaceSearchResult — fetched at request time, not stored in DB. */
export type PlaceSearchResult = {
  placeId: string;
  name: string;
  address: string;
};

/** OpenAPI PlaceDTO — display only (guardrail 7: no persistence). */
export type PlacePhotoAttribution = {
  name: string;
  uri: string;
};

export type PlacePhoto = {
  url: string;
  authorAttributions: PlacePhotoAttribution[];
};

export type PlaceDTO = {
  placeId: string;
  name: string;
  address: string;
  photos: PlacePhoto[];
  openNow?: boolean;
};
