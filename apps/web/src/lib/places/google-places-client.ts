import "server-only";

import type { PlaceDTO, PlaceSearchResult } from "./types";

const PLACES_BASE = "https://places.googleapis.com/v1";

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
type GooglePlace = {
  id?: string;
  displayName?: GoogleDisplayName;
  formattedAddress?: string;
  currentOpeningHours?: { openNow?: boolean };
};

function mapPlace(place: GooglePlace): PlaceDTO | null {
  const placeId = place.id ? normalizePlaceId(place.id) : null;
  const name = place.displayName?.text?.trim();
  if (!placeId || !name) {
    return null;
  }

  return {
    placeId,
    name,
    address: place.formattedAddress ?? "",
    // Place Photos media URLs require the API key; omit to keep the key server-side.
    photos: [],
    ...(place.currentOpeningHours?.openNow !== undefined
      ? { openNow: place.currentOpeningHours.openNow }
      : {}),
  };
}

async function placesFetch<T>(
  path: string,
  init: RequestInit & { fieldMask: string },
): Promise<T> {
  const apiKey = readApiKey();
  const response = await fetch(`${PLACES_BASE}${path}`, {
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

/** Fetch place details at render time (guardrail 7 — no server-side cache). */
export async function fetchPlaceDetails(placeId: string): Promise<PlaceDTO | null> {
  const normalized = normalizePlaceId(placeId);
  const fieldMask =
    "id,displayName,formattedAddress,currentOpeningHours";

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
      body: JSON.stringify({ textQuery: trimmed, pageSize: 20 }),
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
