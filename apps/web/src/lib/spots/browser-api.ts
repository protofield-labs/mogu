"use client";

import { readApiErrorResponse } from "@/lib/auth/api-error";
import { authFetch } from "@/lib/auth/auth-fetch";
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
  const response = await authFetch(`/api/v1/collections/${collectionId}/spots`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw await readApiErrorResponse(response, "スポットを追加できませんでした");
  }
  return (await response.json()) as Spot;
}

export async function updateSpot(id: string, input: UpdateSpotInput): Promise<Spot> {
  const response = await authFetch(`/api/v1/spots/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw await readApiErrorResponse(response, "スポットを更新できませんでした");
  }
  return (await response.json()) as Spot;
}

export async function deleteSpot(id: string): Promise<void> {
  const response = await authFetch(`/api/v1/spots/${id}`, { method: "DELETE" });
  if (!response.ok) {
    throw await readApiErrorResponse(response, "スポットを削除できませんでした");
  }
}
