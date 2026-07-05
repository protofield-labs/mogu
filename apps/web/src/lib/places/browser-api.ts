"use client";

import { parseApiErrorBody } from "@/lib/auth/api-error";
import { authFetch } from "@/lib/auth/auth-fetch";

export type PlaceSearchResult = {
  placeId: string;
  name: string;
  address: string;
  openNow?: boolean;
};

async function readApiError(response: Response, fallback: string): Promise<Error> {
  const body = await parseApiErrorBody(response);
  return new Error(body?.error.message ?? fallback);
}

export async function searchPlaces(query: string): Promise<PlaceSearchResult[]> {
  const response = await authFetch(
    `/api/v1/places/search?q=${encodeURIComponent(query)}`,
  );
  if (!response.ok) {
    throw await readApiError(response, "店舗を検索できませんでした");
  }
  return (await response.json()) as PlaceSearchResult[];
}
