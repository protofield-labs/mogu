"use client";

import { apiJson } from "@/lib/api/browser-client";
import {
  placeLocationListSchema,
  placeSearchResultListSchema,
} from "@/lib/api/schemas/places";
import type { PlaceLocationDTO } from "@/lib/places/types";
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

export async function fetchPlaceLocations(
  placeIds: string[],
): Promise<PlaceLocationDTO[]> {
  const uniqueIds = [...new Set(placeIds.filter((id) => id.length > 0))];
  if (uniqueIds.length === 0) {
    return [];
  }

  const chunks: string[][] = [];
  for (let index = 0; index < uniqueIds.length; index += 50) {
    chunks.push(uniqueIds.slice(index, index + 50));
  }

  const batches = await Promise.all(
    chunks.map((chunk) =>
      apiJson(
        "/api/v1/places/locations",
        placeLocationListSchema,
        "店舗の位置情報を読み込めませんでした",
        {
          init: {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ placeIds: chunk }),
          },
        },
      ),
    ),
  );

  return batches.flat();
}
