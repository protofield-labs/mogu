import "server-only";

import type { PlaceDTO, PlaceLocationDTO, PlacePhoto, PlaceSearchResult } from "./types";
import { buildPlacePhotoProxyUrl } from "./place-photo-url";
import { getCachedPlacesResponse } from "./places-response-cache";

const PLACES_BASE = "https://places.googleapis.com/v1";
const PLACES_LANGUAGE_CODE = "ja";
const PLACES_REGION_CODE = "JP";

export class PlacesApiNotConfiguredError extends Error {
  constructor() {
    super("PLACES_API_KEY is not configured");
    this.name = "PlacesApiNotConfiguredError";
  }
}

export class PlacesApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "PlacesApiError";
  }
}

function readApiKey(): string {
  const key = process.env.PLACES_API_KEY?.trim();
  if (!key) {
    throw new PlacesApiNotConfiguredError();
  }
  return key;
}

function normalizePlaceId(raw: string): string {
  return raw.startsWith("places/") ? raw.slice("places/".length) : raw;
}

type GoogleDisplayName = { text?: string };
type GoogleLatLng = { latitude?: number; longitude?: number };

type GooglePhotoAttribution = { displayName?: string; uri?: string };

type GooglePhoto = {
  name?: string;
  widthPx?: number;
  heightPx?: number;
  authorAttributions?: GooglePhotoAttribution[];
};

type GooglePlace = {
  id?: string;
  displayName?: GoogleDisplayName;
  formattedAddress?: string;
  location?: GoogleLatLng;
  currentOpeningHours?: { openNow?: boolean };
  photos?: GooglePhoto[];
};

function mapLocation(location: GoogleLatLng | undefined): PlaceDTO["location"] {
  const lat = location?.latitude;
  const lng = location?.longitude;
  if (typeof lat !== "number" || typeof lng !== "number") {
    return undefined;
  }
  return { lat, lng };
}

function mapPhotos(placeId: string, photos: GooglePhoto[] | undefined): PlacePhoto[] {
  return (photos ?? []).slice(0, 5).map((photo, index) => ({
    url: buildPlacePhotoProxyUrl(placeId, index),
    authorAttributions: (photo.authorAttributions ?? [])
      .map((attr) => ({
        name: attr.displayName?.trim() ?? "",
        uri: attr.uri?.trim() ?? "",
      }))
      .filter((attr) => attr.name.length > 0),
  }));
}

function mapPlace(place: GooglePlace): PlaceDTO | null {
  const placeId = place.id ? normalizePlaceId(place.id) : null;
  const name = place.displayName?.text?.trim();
  if (!placeId || !name) {
    return null;
  }

  const location = mapLocation(place.location);

  return {
    placeId,
    name,
    address: place.formattedAddress ?? "",
    photos: mapPhotos(placeId, place.photos),
    ...(location ? { location } : {}),
    ...(place.currentOpeningHours?.openNow !== undefined
      ? { openNow: place.currentOpeningHours.openNow }
      : {}),
  };
}

function mapPlaceLocation(place: GooglePlace): PlaceLocationDTO | null {
  const placeId = place.id ? normalizePlaceId(place.id) : null;
  const name = place.displayName?.text?.trim();
  const location = mapLocation(place.location);
  if (!placeId || !name || !location) {
    return null;
  }

  return {
    placeId,
    name,
    lat: location.lat,
    lng: location.lng,
  };
}

function withLanguageQuery(path: string): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}languageCode=${PLACES_LANGUAGE_CODE}`;
}

async function placesFetch<T>(
  path: string,
  init: RequestInit & { fieldMask: string },
): Promise<T> {
  const apiKey = readApiKey();
  const response = await fetch(`${PLACES_BASE}${withLanguageQuery(path)}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": init.fieldMask,
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new PlacesApiError(
      detail || `Places API request failed (${response.status})`,
      response.status,
    );
  }

  return (await response.json()) as T;
}

/** Fetch place details at render time (guardrail 7 — no DB persistence; short TTL cache OK). */
export async function fetchPlaceDetails(placeId: string): Promise<PlaceDTO | null> {
  const normalized = normalizePlaceId(placeId);
  return getCachedPlacesResponse(`details:${normalized}`, () =>
    fetchPlaceDetailsUncached(normalized),
  );
}

async function fetchPlaceDetailsUncached(normalized: string): Promise<PlaceDTO | null> {
  const fieldMask =
    "id,displayName,formattedAddress,location,currentOpeningHours,photos";

  try {
    const place = await placesFetch<GooglePlace>(
      `/places/${encodeURIComponent(normalized)}`,
      { method: "GET", fieldMask },
    );
    return mapPlace(place);
  } catch (error) {
    if (error instanceof PlacesApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

/** Text search for place autocomplete (#33). Results are not persisted. */
export async function searchPlaces(query: string): Promise<PlaceSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length === 0) {
    return [];
  }

  const data = await placesFetch<{ places?: GooglePlace[] }>(
    "/places:searchText",
    {
      method: "POST",
      fieldMask: "places.id,places.displayName,places.formattedAddress",
      body: JSON.stringify({
        textQuery: trimmed,
        pageSize: 20,
        languageCode: PLACES_LANGUAGE_CODE,
        regionCode: PLACES_REGION_CODE,
      }),
    },
  );

  return (data.places ?? [])
    .map((place) => {
      const placeId = place.id ? normalizePlaceId(place.id) : null;
      const name = place.displayName?.text?.trim();
      if (!placeId || !name) {
        return null;
      }
      return {
        placeId,
        name,
        address: place.formattedAddress ?? "",
      };
    })
    .filter((item): item is PlaceSearchResult => item !== null);
}

const PLACE_LOCATIONS_FIELD_MASK = "id,displayName,location";

/** Resolve coordinates for map pins (guardrail 7 — no DB persistence; short TTL cache OK). */
export async function fetchPlaceLocations(
  placeIds: string[],
): Promise<PlaceLocationDTO[]> {
  const uniqueIds = [...new Set(placeIds.map(normalizePlaceId).filter(Boolean))];
  if (uniqueIds.length === 0) {
    return [];
  }

  const results = await Promise.all(
    uniqueIds.map((placeId) =>
      getCachedPlacesResponse(`location:${placeId}`, () =>
        fetchPlaceLocationUncached(placeId),
      ),
    ),
  );

  return results.filter((item): item is PlaceLocationDTO => item !== null);
}

async function fetchPlaceLocationUncached(
  placeId: string,
): Promise<PlaceLocationDTO | null> {
  try {
    const place = await placesFetch<GooglePlace>(
      `/places/${encodeURIComponent(placeId)}`,
      { method: "GET", fieldMask: PLACE_LOCATIONS_FIELD_MASK },
    );
    return mapPlaceLocation(place);
  } catch (error) {
    if (error instanceof PlacesApiError) {
      return null;
    }
    throw error;
  }
}

const PLACE_PHOTOS_FIELD_MASK = "photos";

/** Stream Place Photos media bytes via server-side proxy (guardrail 7). */
export async function fetchPlacePhotoMedia(
  placeId: string,
  index: number,
): Promise<{ body: ReadableStream<Uint8Array>; contentType: string } | null> {
  if (index < 0) {
    return null;
  }

  const normalized = normalizePlaceId(placeId);
  const place = await getCachedPlacesResponse(`photos:${normalized}`, () =>
    placesFetch<{ photos?: GooglePhoto[] }>(
      `/places/${encodeURIComponent(normalized)}`,
      { method: "GET", fieldMask: PLACE_PHOTOS_FIELD_MASK },
    ),
  );
  const photo = place.photos?.[index];
  const photoName = photo?.name?.trim();
  if (!photoName) {
    return null;
  }

  const apiKey = readApiKey();
  const mediaUrl = `${PLACES_BASE}/${photoName}/media?maxHeightPx=800&maxWidthPx=1200`;
  const response = await fetch(mediaUrl, {
    headers: { "X-Goog-Api-Key": apiKey },
    redirect: "follow",
    cache: "no-store",
  });

  if (!response.ok || !response.body) {
    throw new PlacesApiError(
      `Place photo media request failed (${response.status})`,
      response.status,
    );
  }

  return {
    body: response.body,
    contentType: response.headers.get("Content-Type") ?? "image/jpeg",
  };
}
