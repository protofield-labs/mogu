import { DEFAULT_AVATAR_COLOR, ONBOARDING_AVATAR_COLORS } from "@/lib/user-profile";

import type { FriendUser } from "./types";

const AVATAR_COLOR_LABELS: Record<string, string> = {
  [DEFAULT_AVATAR_COLOR]: "グレー",
  "#D97706": "オレンジ",
  "#DC2626": "レッド",
  "#DB2777": "ピンク",
  "#7C3AED": "パープル",
  "#2563EB": "ブルー",
  "#0891B2": "シアン",
  "#059669": "グリーン",
  "#65A30D": "ライム",
};

/** Map API errors to user-facing Japanese (#84). */
export function formatFriendRequestError(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) {
    return fallback;
  }
  const message = error.message;
  if (message.includes("Friend request already exists")) {
    return "すでに申請済みです";
  }
  if (message.includes("Cannot send a friend request to yourself")) {
    return "自分自身には申請できません";
  }
  if (message.includes("User not found")) {
    return "ユーザーが見つかりません";
  }
  return message || fallback;
}

/** displayName values that appear more than once in the same list (#94). */
export function findDuplicateDisplayNames(users: FriendUser[]): Set<string> {
  const counts = new Map<string, number>();
  for (const user of users) {
    counts.set(user.displayName, (counts.get(user.displayName) ?? 0) + 1);
  }
  return new Set(
    [...counts.entries()]
      .filter(([, count]) => count > 1)
      .map(([name]) => name),
  );
}

/** Short color label within spec (name + avatar only) for duplicate disambiguation (#94). */
export function formatAvatarColorLabel(avatarColor: string): string {
  const normalized = avatarColor.toUpperCase();
  const fromPalette =
    AVATAR_COLOR_LABELS[normalized] ?? AVATAR_COLOR_LABELS[avatarColor];
  if (fromPalette) {
    return fromPalette;
  }
  if ((ONBOARDING_AVATAR_COLORS as readonly string[]).includes(normalized)) {
    return normalized;
  }
  return avatarColor;
}

export function isOutgoingPending(
  userId: string,
  outgoingUserIds: ReadonlySet<string>,
): boolean {
  return outgoingUserIds.has(userId);
}

export function isAlreadyFriend(
  userId: string,
  friendIds: ReadonlySet<string>,
): boolean {
  return friendIds.has(userId);
}

export function isIncomingPending(
  userId: string,
  incomingUserIds: ReadonlySet<string>,
): boolean {
  return incomingUserIds.has(userId);
}
