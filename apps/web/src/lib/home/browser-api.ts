"use client";

import {
  apiJson,
  apiJsonOrNull,
  apiVoid,
  parseApiJson,
} from "@/lib/api/browser-client";
import { feedPageSchema, recommendationSchema } from "@/lib/api/schemas/home";
import { authFetch } from "@/lib/auth/auth-fetch";
import type { FeedPage, Recommendation } from "@/lib/home/types";

export async function fetchFeedPage(cursor?: string | null): Promise<FeedPage> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  const response = await authFetch(`/api/v1/feed${query}`);
  if (response.status === 422) {
    throw new Error("フィードのページング情報が不正です");
  }
  return parseApiJson(response, feedPageSchema, "フィードを読み込めませんでした");
}

export async function fetchHomeRecommendation(): Promise<Recommendation | null> {
  return apiJsonOrNull(
    "/api/v1/home/recommendation",
    recommendationSchema,
    "一推しを読み込めませんでした",
    { emptyStatuses: [204, 404] },
  );
}
