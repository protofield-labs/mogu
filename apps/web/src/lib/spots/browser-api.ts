"use client";

import { parseApiErrorBody } from "@/lib/auth/api-error";
import { authFetch } from "@/lib/auth/auth-fetch";

export type SpotRating = "again" | "either" | "no";

export type Spot = {
  id: string;
  placeId: string;
  addedBy: string;
  collectionId: string;
  photoUrls: string[];
  comment: string;
  rating: SpotRating;
  structuredTags: {
    area: string | null;
    genre: string | null;
    situation: string | null;
  };
  freeTags: string[];
  savedCount: number;
  originUserId: string | null;
  createdAt: string;
};

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

async function readApiError(response: Response, fallback: string): Promise<Error> {
  const body = await parseApiErrorBody(response);
  return new Error(body?.error.message ?? fallback);
}

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
    throw await readApiError(response, "スポットを追加できませんでした");
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
    throw await readApiError(response, "スポットを更新できませんでした");
  }
  return (await response.json()) as Spot;
}

export async function deleteSpot(id: string): Promise<void> {
  const response = await authFetch(`/api/v1/spots/${id}`, { method: "DELETE" });
  if (!response.ok) {
    throw await readApiError(response, "スポットを削除できませんでした");
  }
}
