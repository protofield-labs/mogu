"use client";

import { apiJson, apiVoid } from "@/lib/api/browser-client";
import {
  collectionDetailSchema,
  collectionSchema,
} from "@/lib/api/schemas/collection";
import { z } from "zod";
import type { Spot } from "@/lib/spots/browser-api";

export type CollectionVisibility = "friends" | "secret";

export type Collection = z.infer<typeof collectionSchema>;

export type CollectionInput = {
  name: string;
  description?: string;
  visibility: CollectionVisibility;
  theme?: string;
};

export type CollectionUpdateInput = {
  name?: string;
  description?: string | null;
  visibility?: CollectionVisibility;
  theme?: string | null;
  coverUrl?: string | null;
};

export type CollectionDetail = Collection & {
  spots: Spot[];
};

const collectionListSchema = z.array(collectionSchema);

export async function getCollectionDetail(id: string): Promise<CollectionDetail> {
  return apiJson(
    `/api/v1/collections/${id}`,
    collectionDetailSchema,
    "コレクションを読み込めませんでした",
  );
}

export async function listMyCollections(): Promise<Collection[]> {
  return apiJson(
    "/api/v1/collections?ownerId=me",
    collectionListSchema,
    "コレクションを読み込めませんでした",
  );
}

export async function createCollection(
  input: CollectionInput,
): Promise<Collection> {
  return apiJson("/api/v1/collections", collectionSchema, "コレクションを作成できませんでした", {
    init: {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  });
}

export async function updateCollection(
  id: string,
  input: CollectionUpdateInput,
): Promise<Collection> {
  return apiJson(
    `/api/v1/collections/${id}`,
    collectionSchema,
    "コレクションを更新できませんでした",
    {
      init: {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
    },
  );
}

export async function deleteCollection(id: string): Promise<void> {
  await apiVoid(`/api/v1/collections/${id}`, "コレクションを削除できませんでした", {
    method: "DELETE",
  });
}
