"use client";

import { z } from "zod";

import { apiJson, apiVoid, parseApiJson } from "@/lib/api/browser-client";
import { spotSchema } from "@/lib/api/schemas/spot";
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

export type RecollectSpotResult =
  | { ok: true; spot: Spot }
  | { ok: false; error: string };

/** Copy a friend's spot into the viewer's collection (#40, #112). */
export async function recollectSpot(
  spotId: string,
  targetCollectionId: string,
): Promise<RecollectSpotResult> {
  const response = await authFetch(`/api/v1/spots/${spotId}/recollect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetCollectionId }),
  });
  if (!response.ok) {
    const error = await readApiErrorResponse(response, "保存に失敗しました");
    return { ok: false, error: error.message };
  }

  try {
    const spot = await parseApiJson(response, spotSchema, "保存に失敗しました");
    return { ok: true, spot };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "保存に失敗しました",
    };
  }
}

const unrecollectResponseSchema = z.object({
  savedCount: z.number().int().min(0).nullable(),
});

/**
 * Remove the viewer's recollection copy created from this source spot (#283).
 * Returns the refreshed place-level savedCount (null when nothing was deleted).
 */
export async function unrecollectSpot(
  spotId: string,
): Promise<{ savedCount: number | null }> {
  return apiJson(
    `/api/v1/spots/${spotId}/recollect`,
    unrecollectResponseSchema,
    "保存を解除できませんでした",
    { init: { method: "DELETE" } },
  );
}

export { getSpotDetail, type SpotDetail } from "@/lib/share/browser-api";
