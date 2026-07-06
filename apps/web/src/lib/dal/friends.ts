import "server-only";

import { withAuthRls } from "@/lib/auth/with-auth-rls";
import type { PrismaTransaction } from "@/lib/db/prisma";
import { toUserDto, userSelect, type UserDto } from "@/lib/dal/users";
import {
  decodeFriendshipPairId,
  encodeFriendshipPairId,
  type FriendshipPair,
} from "@/lib/friendship/pair";

type FriendshipWithUsers = {
  userLow: string;
  userHigh: string;
  status: "pending" | "accepted";
  requestedBy: string;
  createdAt: Date;
  userLowUser: Parameters<typeof toUserDto>[0];
  userHighUser: Parameters<typeof toUserDto>[0];
  requestedByUser: Parameters<typeof toUserDto>[0];
};

export type FriendRequestStatusDto = {
  pairId: string;
  status: "pending" | "accepted";
};

export type FriendRequestDto = FriendRequestStatusDto & {
  from: UserDto;
  to: UserDto;
  createdAt: string;
};

export type SendFriendRequestResult =
  | { ok: true; request: FriendRequestStatusDto }
  | { ok: false; reason: "self" | "not_found" | "conflict" };

export type ResolveFriendRequestResult =
  | { ok: true; request: FriendRequestStatusDto }
  | { ok: false; reason: "invalid_pair_id" | "not_found" | "forbidden" };

export type RejectFriendRequestResult =
  | { ok: true }
  | {
      ok: false;
      reason: "invalid_pair_id" | "not_found" | "forbidden" | "conflict";
    };

async function resolvePairFromDb(
  tx: PrismaTransaction,
  a: string,
  b: string,
): Promise<FriendshipPair> {
  const rows = await tx.$queryRaw<{ user_low: string; user_high: string }[]>`
    SELECT LEAST(${a}::text, ${b}::text) AS user_low,
           GREATEST(${a}::text, ${b}::text) AS user_high
  `;
  const row = rows[0];
  if (!row) {
    throw new Error("Failed to resolve friendship pair");
  }
  const pair = { userLow: row.user_low, userHigh: row.user_high };
  if (pair.userLow === pair.userHigh) {
    throw new Error("Friendship pair must have distinct user ids");
  }
  return pair;
}

/** Decode pairId then canonicalize with PostgreSQL LEAST/GREATEST. */
async function resolveCanonicalPairFromPairId(
  tx: PrismaTransaction,
  pairId: string,
): Promise<FriendshipPair | null> {
  const decoded = decodeFriendshipPairId(pairId);
  if (!decoded) {
    return null;
  }

  try {
    return await resolvePairFromDb(tx, decoded.userLow, decoded.userHigh);
  } catch {
    return null;
  }
}

function toFriendRequestDto(row: FriendshipWithUsers): FriendRequestDto {
  const fromUser = toUserDto(row.requestedByUser);
  const toUser =
    row.requestedBy === row.userLow
      ? toUserDto(row.userHighUser)
      : toUserDto(row.userLowUser);

  return {
    pairId: encodeFriendshipPairId({
      userLow: row.userLow,
      userHigh: row.userHigh,
    }),
    from: fromUser,
    to: toUser,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}

const friendshipInclude = {
  userLowUser: { select: userSelect },
  userHighUser: { select: userSelect },
  requestedByUser: { select: userSelect },
} as const;

export async function sendFriendRequest(
  uid: string,
  toUserId: string,
): Promise<SendFriendRequestResult> {
  if (uid === toUserId) {
    return { ok: false, reason: "self" };
  }

  const result = await withAuthRls(uid, async (tx) => {
    const pair = await resolvePairFromDb(tx, uid, toUserId);

    const targetUser = await tx.user.findUnique({
      where: { firebaseUid: toUserId },
      select: { firebaseUid: true },
    });
    if (!targetUser) {
      return { ok: false as const, reason: "not_found" as const };
    }

    const existing = await tx.friendship.findUnique({
      where: {
        userLow_userHigh: pair,
      },
    });
    if (existing) {
      return { ok: false as const, reason: "conflict" as const };
    }

    const friendship = await tx.friendship.create({
      data: {
        ...pair,
        status: "pending",
        requestedBy: uid,
      },
      select: {
        status: true,
      },
    });

    return {
      ok: true as const,
      request: {
        pairId: encodeFriendshipPairId(pair),
        status: friendship.status,
      },
    };
  });

  return result;
}

export async function listFriendRequests(
  uid: string,
  box: "in" | "out",
): Promise<FriendRequestDto[]> {
  const requests = await withAuthRls(uid, (tx) =>
    tx.friendship.findMany({
      where: {
        status: "pending",
        OR: [{ userLow: uid }, { userHigh: uid }],
        ...(box === "in"
          ? { requestedBy: { not: uid } }
          : { requestedBy: uid }),
      },
      include: friendshipInclude,
      orderBy: { createdAt: "desc" },
    }),
  );

  return requests.map(toFriendRequestDto);
}

export async function acceptFriendRequest(
  uid: string,
  pairId: string,
): Promise<ResolveFriendRequestResult> {
  const result = await withAuthRls(uid, async (tx) => {
    const pair = await resolveCanonicalPairFromPairId(tx, pairId);
    if (!pair) {
      return { ok: false as const, reason: "invalid_pair_id" as const };
    }
    const canonicalPairId = encodeFriendshipPairId(pair);

    const friendship = await tx.friendship.findUnique({
      where: { userLow_userHigh: pair },
    });
    if (!friendship) {
      return { ok: false as const, reason: "not_found" as const };
    }
    if (friendship.requestedBy === uid) {
      return { ok: false as const, reason: "forbidden" as const };
    }
    if (friendship.status === "accepted") {
      return {
        ok: true as const,
        request: { pairId: canonicalPairId, status: "accepted" as const },
      };
    }

    const accepted = await tx.friendship.update({
      where: { userLow_userHigh: pair },
      data: {
        status: "accepted",
        acceptedAt: new Date(),
      },
      select: {
        status: true,
      },
    });

    return {
      ok: true as const,
      request: { pairId: canonicalPairId, status: accepted.status },
    };
  });

  return result;
}

export async function rejectFriendRequest(
  uid: string,
  pairId: string,
): Promise<RejectFriendRequestResult> {
  const result = await withAuthRls(uid, async (tx) => {
    const pair = await resolveCanonicalPairFromPairId(tx, pairId);
    if (!pair) {
      return { ok: false as const, reason: "invalid_pair_id" as const };
    }

    const friendship = await tx.friendship.findUnique({
      where: { userLow_userHigh: pair },
    });
    if (!friendship) {
      return { ok: false as const, reason: "not_found" as const };
    }
    if (friendship.requestedBy === uid) {
      return { ok: false as const, reason: "forbidden" as const };
    }
    if (friendship.status !== "pending") {
      return { ok: false as const, reason: "conflict" as const };
    }

    await tx.friendship.delete({
      where: { userLow_userHigh: pair },
    });

    return { ok: true as const };
  });

  return result;
}

export async function listFriends(uid: string): Promise<UserDto[]> {
  const friendships = await withAuthRls(uid, (tx) =>
    tx.friendship.findMany({
      where: {
        status: "accepted",
        OR: [{ userLow: uid }, { userHigh: uid }],
      },
      include: friendshipInclude,
      orderBy: [{ acceptedAt: "desc" }, { createdAt: "desc" }],
    }),
  );

  return friendships.map((friendship) => {
    const friendUser =
      friendship.userLow === uid
        ? friendship.userHighUser
        : friendship.userLowUser;
    return toUserDto(friendUser);
  });
}
