"use client";

import { apiJson } from "@/lib/api/browser-client";
import { placeSearchResultListSchema } from "@/lib/api/schemas/places";
import { z } from "zod";

export type PlaceSearchResult = z.infer<
  typeof placeSearchResultListSchema
>[number];

export async function searchPlaces(query: string): Promise<PlaceSearchResult[]> {
  return apiJson(
    `/api/v1/places/search?q=${encodeURIComponent(query)}`,
    placeSearchResultListSchema,
    "店舗を検索できませんでした",
  );
}
