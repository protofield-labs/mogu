"use client";

import { parseApiErrorBody } from "@/lib/auth/api-error";
import { authFetch } from "@/lib/auth/auth-fetch";
import type { Collection } from "@/lib/collections/browser-api";
import type {
  FlagNotification,
  FriendRequest,
  FriendUser,
  MeBadges,
  MeProfile,
} from "@/lib/mypage/types";

async function readApiError(response: Response, fallback: string): Promise<Error> {
  const body = await parseApiErrorBody(response);
  return new Error(body?.error.message ?? fallback);
}

export async function fetchMe(): Promise<MeProfile> {
  const response = await authFetch("/api/v1/me");
  if (!response.ok) {
    throw await readApiError(response, "プロフィールを読み込めませんでした");
  }
  return (await response.json()) as MeProfile;
}

export async function fetchMeBadges(): Promise<MeBadges> {
  const response = await authFetch("/api/v1/me/badges");
  if (!response.ok) {
    throw await readApiError(response, "バッジを読み込めませんでした");
  }
  return (await response.json()) as MeBadges;
}

export async function fetchFlagNotifications(): Promise<FlagNotification[]> {
  const response = await authFetch("/api/v1/flags");
  if (!response.ok) {
    throw await readApiError(response, "フラグを読み込めませんでした");
  }
  return (await response.json()) as FlagNotification[];
}

export async function markFlagsRead(): Promise<number> {
  const response = await authFetch("/api/v1/flags/read", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!response.ok) {
    throw await readApiError(response, "フラグを既読にできませんでした");
  }
  const body = (await response.json()) as { updated: number };
  return body.updated;
}

export async function fetchFriends(): Promise<FriendUser[]> {
  const response = await authFetch("/api/v1/friends");
  if (!response.ok) {
    throw await readApiError(response, "友達一覧を読み込めませんでした");
  }
  return (await response.json()) as FriendUser[];
}

export async function fetchFriendCollectionCount(friendId: string): Promise<number> {
  const response = await authFetch(
    `/api/v1/collections?ownerId=${encodeURIComponent(friendId)}`,
  );
  if (!response.ok) {
    return 0;
  }
  const collections = (await response.json()) as Collection[];
  return collections.length;
}

export async function fetchIncomingFriendRequests(): Promise<FriendRequest[]> {
  const response = await authFetch("/api/v1/friends/requests?box=in");
  if (!response.ok) {
    throw await readApiError(response, "友達申請を読み込めませんでした");
  }
  return (await response.json()) as FriendRequest[];
}

export async function searchUsers(query: string): Promise<FriendUser[]> {
  const response = await authFetch(
    `/api/v1/users/search?q=${encodeURIComponent(query)}`,
  );
  if (!response.ok) {
    throw await readApiError(response, "ユーザーを検索できませんでした");
  }
  return (await response.json()) as FriendUser[];
}

export async function sendFriendRequest(toUserId: string): Promise<void> {
  const response = await authFetch("/api/v1/friends/requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ toUserId }),
  });
  if (!response.ok) {
    throw await readApiError(response, "友達申請を送信できませんでした");
  }
}

export async function acceptFriendRequest(pairId: string): Promise<void> {
  const response = await authFetch(
    `/api/v1/friends/requests/${encodeURIComponent(pairId)}/accept`,
    { method: "POST" },
  );
  if (!response.ok) {
    throw await readApiError(response, "友達申請を承認できませんでした");
  }
}
