import "server-only";

import { withAuthRls } from "@/lib/auth/with-auth-rls";
import { toUserDto, userSelect, type UserDto } from "@/lib/dal/users";

type FriendshipPair = {
  userLow: string;
  userHigh: string;
};

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

function normalizePair(a: string, b: string): FriendshipPair {
  return a < b ? { userLow: a, userHigh: b } : { userLow: b, userHigh: a };
}

export function encodePairId(pair: FriendshipPair): string {
  return Buffer.from(JSON.stringify([pair.userLow, pair.userHigh]), "utf8")
    .toString("base64url");
}

export function decodePairId(pairId: string): FriendshipPair | null {
  try {
    const value = JSON.parse(
      Buffer.from(pairId, "base64url").toString("utf8"),
    );
    if (
      Array.isArray(value) &&
      value.length === 2 &&
      typeof value[0] === "string" &&
      typeof value[1] === "string" &&
      value[0] < value[1]
    ) {
      return { userLow: value[0], userHigh: value[1] };
    }
    return null;
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
    pairId: encodePairId(row),
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

  const pair = normalizePair(uid, toUserId);
  const result = await withAuthRls(uid, async (tx) => {
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
        pairId: encodePairId(pair),
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
  const pair = decodePairId(pairId);
  if (!pair) {
    return { ok: false, reason: "invalid_pair_id" };
  }

  const result = await withAuthRls(uid, async (tx) => {
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
        request: { pairId, status: "accepted" as const },
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
      request: { pairId, status: accepted.status },
    };
  });

  return result;
}

export async function rejectFriendRequest(
  uid: string,
  pairId: string,
): Promise<RejectFriendRequestResult> {
  const pair = decodePairId(pairId);
  if (!pair) {
    return { ok: false, reason: "invalid_pair_id" };
  }

  const result = await withAuthRls(uid, async (tx) => {
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
