"use client";

import { apiJson, apiVoid, parseApiJson } from "@/lib/api/browser-client";
import { collectionSchema } from "@/lib/api/schemas/collection";
import {
  flagNotificationListSchema,
  flagsReadResponseSchema,
  friendRequestListSchema,
  friendUserListSchema,
  meBadgesSchema,
} from "@/lib/api/schemas/social";
import { meProfileSchema, userSchema } from "@/lib/users/types";
import { authFetch } from "@/lib/auth/auth-fetch";
import { z } from "zod";
import type {
  FlagNotification,
  FriendRequest,
  FriendUser,
  MeBadges,
  MeProfile,
} from "@/lib/mypage/types";

const collectionListSchema = z.array(collectionSchema);

export async function fetchMe(): Promise<MeProfile> {
  return apiJson("/api/v1/me", meProfileSchema, "プロフィールを読み込めませんでした");
}

export async function updateMeProfile(body: {
  displayName: string;
  avatarColor: string;
}): Promise<Pick<MeProfile, "id" | "displayName" | "avatarColor">> {
  return apiJson("/api/v1/me", userSchema, "プロフィールを保存できませんでした", {
    init: {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  });
}

export async function fetchMeBadges(): Promise<MeBadges> {
  return apiJson("/api/v1/me/badges", meBadgesSchema, "バッジを読み込めませんでした");
}

export async function fetchFlagNotifications(): Promise<FlagNotification[]> {
  return apiJson(
    "/api/v1/flags",
    flagNotificationListSchema,
    "フラグを読み込めませんでした",
  );
}

export async function markFlagsRead(): Promise<number> {
  const body = await apiJson(
    "/api/v1/flags/read",
    flagsReadResponseSchema,
    "フラグを既読にできませんでした",
    {
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
    },
  );
  return body.updated;
}

export async function fetchFriends(): Promise<FriendUser[]> {
  return apiJson("/api/v1/friends", friendUserListSchema, "友達一覧を読み込めませんでした");
}

export async function fetchFriendCollectionCount(friendId: string): Promise<number> {
  try {
    const response = await authFetch(
      `/api/v1/collections?ownerId=${encodeURIComponent(friendId)}`,
    );
    if (!response.ok) {
      return 0;
    }
    const parsed = await parseApiJson(
      response,
      collectionListSchema,
      "コレクションを読み込めませんでした",
    );
    return parsed.length;
  } catch {
    return 0;
  }
}

export async function fetchIncomingFriendRequests(): Promise<FriendRequest[]> {
  return apiJson(
    "/api/v1/friends/requests?box=in",
    friendRequestListSchema,
    "友達申請を読み込めませんでした",
  );
}

export async function fetchOutgoingFriendRequests(): Promise<FriendRequest[]> {
  return apiJson(
    "/api/v1/friends/requests?box=out",
    friendRequestListSchema,
    "送信済み申請を読み込めませんでした",
  );
}

export async function searchUsers(query: string): Promise<FriendUser[]> {
  return apiJson(
    `/api/v1/users/search?q=${encodeURIComponent(query)}`,
    friendUserListSchema,
    "ユーザーを検索できませんでした",
  );
}

export async function sendFriendRequest(toUserId: string): Promise<void> {
  await apiVoid("/api/v1/friends/requests", "友達申請を送信できませんでした", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ toUserId }),
  });
}

export async function acceptFriendRequest(pairId: string): Promise<void> {
  await apiVoid(
    `/api/v1/friends/requests/${encodeURIComponent(pairId)}/accept`,
    "友達申請を承認できませんでした",
    { method: "POST" },
  );
}

export async function rejectFriendRequest(pairId: string): Promise<void> {
  await apiVoid(
    `/api/v1/friends/requests/${encodeURIComponent(pairId)}/reject`,
    "友達申請を拒否できませんでした",
    { method: "POST" },
  );
}

export async function cancelFriendRequest(pairId: string): Promise<void> {
  await apiVoid(
    `/api/v1/friends/requests/${encodeURIComponent(pairId)}`,
    "友達申請を取り消せませんでした",
    { method: "DELETE" },
  );
}

export async function removeFriend(pairId: string): Promise<void> {
  await apiVoid(
    `/api/v1/friends/${encodeURIComponent(pairId)}`,
    "友達を解除できませんでした",
    { method: "DELETE" },
  );
}
