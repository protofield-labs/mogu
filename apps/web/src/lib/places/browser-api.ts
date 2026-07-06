"use client";

import { readApiErrorResponse } from "@/lib/auth/api-error";
import { authFetch } from "@/lib/auth/auth-fetch";

export type PlaceSearchResult = {
  placeId: string;
  name: string;
  address: string;
  openNow?: boolean;
};

export async function searchPlaces(query: string): Promise<PlaceSearchResult[]> {
  const response = await authFetch(
    `/api/v1/places/search?q=${encodeURIComponent(query)}`,
  );
  if (!response.ok) {
    throw await readApiErrorResponse(response, "店舗を検索できませんでした");
  }
  return (await response.json()) as PlaceSearchResult[];
}
