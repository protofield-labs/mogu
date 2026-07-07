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

export type PlaceLocation = {
  lat: number;
  lng: number;
};

export type PlaceDTO = {
  placeId: string;
  name: string;
  address: string;
  photos: PlacePhoto[];
  location?: PlaceLocation;
  openNow?: boolean;
};

/** Map pin rendering — coordinates resolved at request time (guardrail 7). */
export type PlaceLocationDTO = {
  placeId: string;
  name: string;
  lat: number;
  lng: number;
};
