"use client";

import { apiJson, apiVoid } from "@/lib/api/browser-client";
import { spotSchema } from "@/lib/api/schemas/spot";
import type { SpotDto, SpotRating } from "@/lib/spot/types";

export type { SpotRating };
export type Spot = SpotDto;

export type CreateSpotInput = {
  placeId: string;
  comment: string;
  rating: SpotRating;
  structuredTags?: {
    area?: string | null;
    genre?: string | null;
    situation?: string | null;
  };
  freeTags?: string[];
  photoUrls?: string[];
};

export type UpdateSpotInput = {
  comment?: string;
  rating?: SpotRating;
  structuredTags?: {
    area?: string | null;
    genre?: string | null;
    situation?: string | null;
  };
  freeTags?: string[];
  photoUrls?: string[];
};

export async function createSpot(
  collectionId: string,
  input: CreateSpotInput,
): Promise<Spot> {
  return apiJson(
    `/api/v1/collections/${collectionId}/spots`,
    spotSchema,
    "スポットを追加できませんでした",
    {
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
    },
  );
}

export async function updateSpot(id: string, input: UpdateSpotInput): Promise<Spot> {
  return apiJson(`/api/v1/spots/${id}`, spotSchema, "スポットを更新できませんでした", {
    init: {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  });
}

export async function deleteSpot(id: string): Promise<void> {
  await apiVoid(`/api/v1/spots/${id}`, "スポットを削除できませんでした", {
    method: "DELETE",
  });
}
