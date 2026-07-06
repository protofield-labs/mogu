/** Friendship pair ordering aligned with PostgreSQL LEAST/GREATEST (#79). */

export type FriendshipPair = {
  userLow: string;
  userHigh: string;
};

/** UTF-8 byte order (matches PG text `<` for ASCII Firebase UIDs). */
export function compareFriendshipUids(a: string, b: string): number {
  return Buffer.compare(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

export function isOrderedFriendshipPair(pair: FriendshipPair): boolean {
  return compareFriendshipUids(pair.userLow, pair.userHigh) < 0;
}

/**
 * Order two user ids for friendships.user_low / user_high.
 * Uses byte compare instead of JS `<` so client encode/decode matches DB CHECK.
 */
export function normalizeFriendshipPair(a: string, b: string): FriendshipPair {
  if (compareFriendshipUids(a, b) < 0) {
    return { userLow: a, userHigh: b };
  }
  return { userLow: b, userHigh: a };
}

export function encodeFriendshipPairId(pair: FriendshipPair): string {
  return Buffer.from(JSON.stringify([pair.userLow, pair.userHigh]), "utf8")
    .toString("base64url");
}

export function decodeFriendshipPairId(pairId: string): FriendshipPair | null {
  try {
    const value = JSON.parse(
      Buffer.from(pairId, "base64url").toString("utf8"),
    );
    if (
      !Array.isArray(value) ||
      value.length !== 2 ||
      typeof value[0] !== "string" ||
      typeof value[1] !== "string"
    ) {
      return null;
    }
    const pair = { userLow: value[0], userHigh: value[1] };
    return isOrderedFriendshipPair(pair) ? pair : null;
  } catch {
    return null;
  }
}
