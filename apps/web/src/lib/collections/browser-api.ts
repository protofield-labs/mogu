"use client";

import { parseApiErrorBody } from "@/lib/auth/api-error";
import { authFetch } from "@/lib/auth/auth-fetch";

export type CollectionVisibility = "friends" | "secret";

export type Collection = {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  coverUrl: string | null;
  visibility: CollectionVisibility;
  theme: string | null;
  spotCount: number;
  createdAt: string;
  updatedAt: string;
};

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
};

async function readApiError(response: Response, fallback: string): Promise<Error> {
  const body = await parseApiErrorBody(response);
  return new Error(body?.error.message ?? fallback);
}

export async function listMyCollections(): Promise<Collection[]> {
  const response = await authFetch("/api/v1/collections?ownerId=me");
  if (!response.ok) {
    throw await readApiError(response, "コレクションを読み込めませんでした");
  }
  return (await response.json()) as Collection[];
}

export async function createCollection(
  input: CollectionInput,
): Promise<Collection> {
  const response = await authFetch("/api/v1/collections", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw await readApiError(response, "コレクションを作成できませんでした");
  }
  return (await response.json()) as Collection;
}

export async function updateCollection(
  id: string,
  input: CollectionUpdateInput,
): Promise<Collection> {
  const response = await authFetch(`/api/v1/collections/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw await readApiError(response, "コレクションを更新できませんでした");
  }
  return (await response.json()) as Collection;
}

export async function deleteCollection(id: string): Promise<void> {
  const response = await authFetch(`/api/v1/collections/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw await readApiError(response, "コレクションを削除できませんでした");
  }
}
