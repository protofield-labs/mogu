"use client";

import { z } from "zod";

import { apiJson, apiJsonOrNull } from "@/lib/api/browser-client";
import { friendProfileSchema } from "@/lib/api/schemas/user";
import { collectionSchema } from "@/lib/api/schemas/collection";

export type FriendProfile = z.infer<typeof friendProfileSchema>;

const collectionListSchema = z.array(collectionSchema);

export async function fetchFriendProfile(userId: string): Promise<FriendProfile | null> {
  return apiJsonOrNull(
    `/api/v1/users/${encodeURIComponent(userId)}`,
    friendProfileSchema,
    "プロフィールを読み込めませんでした",
    { emptyStatuses: [404] },
  );
}

export async function listFriendCollections(ownerId: string) {
  return apiJson(
    `/api/v1/collections?ownerId=${encodeURIComponent(ownerId)}`,
    collectionListSchema,
    "コレクションを読み込めませんでした",
  );
}
