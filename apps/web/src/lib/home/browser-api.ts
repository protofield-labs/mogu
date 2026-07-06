"use client";

import { parseApiErrorBody } from "@/lib/auth/api-error";
import { authFetch } from "@/lib/auth/auth-fetch";
import type { FeedPage, Recommendation } from "@/lib/home/types";

async function readApiError(response: Response, fallback: string): Promise<Error> {
  const body = await parseApiErrorBody(response);
  return new Error(body?.error.message ?? fallback);
}

export async function fetchFeedPage(cursor?: string | null): Promise<FeedPage> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  const response = await authFetch(`/api/v1/feed${query}`);
  if (response.status === 422) {
    throw new Error("フィードのページング情報が不正です");
  }
  if (!response.ok) {
    throw await readApiError(response, "フィードを読み込めませんでした");
  }
  return (await response.json()) as FeedPage;
}

export async function fetchHomeRecommendation(): Promise<Recommendation | null> {
  const response = await authFetch("/api/v1/home/recommendation");
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw await readApiError(response, "一推しを読み込めませんでした");
  }
  return (await response.json()) as Recommendation;
}
