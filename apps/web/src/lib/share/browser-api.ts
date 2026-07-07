"use client";

import { z } from "zod";

import { apiJson, apiJsonOrNull, parseApiJson } from "@/lib/api/browser-client";
import { collectionDetailSchema } from "@/lib/api/schemas/collection";
import {
  shareGateSchema,
  userShareGateSchema,
} from "@/lib/api/schemas/share-gate";
import { spotDetailSchema } from "@/lib/api/schemas/spot";
import { readApiErrorResponse } from "@/lib/auth/api-error";
import { authFetch } from "@/lib/auth/auth-fetch";
import type { CollectionDetail } from "@/lib/collections/browser-api";
import type { SpotDto } from "@/lib/spot/types";

export type ShareGate = z.infer<typeof shareGateSchema>;
export type UserShareGate = z.infer<typeof userShareGateSchema>;

export type SpotDetail = SpotDto & {
  collectionName: string;
  ownerId: string;
};

export async function getSpotDetail(id: string): Promise<SpotDetail> {
  return apiJson(
    `/api/v1/spots/${encodeURIComponent(id)}`,
    spotDetailSchema,
    "スポットを読み込めませんでした",
  );
}

export async function fetchCollectionShareGate(
  collectionId: string,
): Promise<ShareGate | null> {
  return apiJsonOrNull(
    `/api/v1/collections/${encodeURIComponent(collectionId)}/gate`,
    shareGateSchema,
    "コレクション情報を読み込めませんでした",
    { emptyStatuses: [404] },
  );
}

export async function fetchSpotShareGate(spotId: string): Promise<ShareGate | null> {
  return apiJsonOrNull(
    `/api/v1/spots/${encodeURIComponent(spotId)}/gate`,
    shareGateSchema,
    "スポット情報を読み込めませんでした",
    { emptyStatuses: [404] },
  );
}

export async function fetchUserShareGate(userId: string): Promise<UserShareGate | null> {
  return apiJsonOrNull(
    `/api/v1/users/${encodeURIComponent(userId)}/gate`,
    userShareGateSchema,
    "プロフィール情報を読み込めませんでした",
    { emptyStatuses: [404] },
  );
}

export type CollectionPageLoadResult =
  | { kind: "detail"; detail: CollectionDetail }
  | { kind: "gate"; gate: ShareGate }
  | { kind: "missing" };

export async function loadCollectionPage(
  collectionId: string,
): Promise<CollectionPageLoadResult> {
  const response = await authFetch(
    `/api/v1/collections/${encodeURIComponent(collectionId)}`,
  );
  if (response.ok) {
    const detail = await parseApiJson(
      response,
      collectionDetailSchema,
      "コレクションを読み込めませんでした",
    );
    return { kind: "detail", detail };
  }
  if (response.status === 404) {
    const gate = await fetchCollectionShareGate(collectionId);
    if (gate) {
      return { kind: "gate", gate };
    }
    return { kind: "missing" };
  }
  throw await readApiErrorResponse(response, "コレクションを読み込めませんでした");
}

export type SpotPageLoadResult =
  | { kind: "detail"; spot: SpotDetail }
  | { kind: "gate"; gate: ShareGate }
  | { kind: "missing" };

export async function loadSpotPage(spotId: string): Promise<SpotPageLoadResult> {
  const response = await authFetch(`/api/v1/spots/${encodeURIComponent(spotId)}`);
  if (response.ok) {
    const spot = await parseApiJson(
      response,
      spotDetailSchema,
      "スポットを読み込めませんでした",
    );
    return { kind: "detail", spot };
  }
  if (response.status === 404) {
    const gate = await fetchSpotShareGate(spotId);
    if (gate) {
      return { kind: "gate", gate };
    }
    return { kind: "missing" };
  }
  throw await readApiErrorResponse(response, "スポットを読み込めませんでした");
}
