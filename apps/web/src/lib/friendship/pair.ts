/** Friendship pair ordering — DB uses PostgreSQL LEAST/GREATEST (#79). */

export type FriendshipPair = {
  userLow: string;
  userHigh: string;
};

/** @internal Verify/seed only — production DAL uses SQL LEAST/GREATEST (#79). */
export function compareFriendshipUids(a: string, b: string): number {
  return Buffer.compare(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

/** Distinct user ids only; ordering is validated by the database CHECK. */
export function isOrderedFriendshipPair(pair: FriendshipPair): boolean {
  return pair.userLow !== pair.userHigh;
}

/**
 * Offline pair ordering (byte compare). Do not use for DB writes — use SQL
 * LEAST/GREATEST via resolveFriendshipPairFromDb instead.
 *
 * @internal Verify/seed only — not used by production DAL.
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
