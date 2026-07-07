import "server-only";

import type { PrismaTransaction } from "@/lib/db/prisma";
import type { FriendshipPair } from "@/lib/friendship/pair";
import {
  classifyFriendshipDeleteFailure,
  type FriendshipDeleteGuard,
  type FriendshipDeleteFailureReason,
} from "@/lib/friendship/delete-guard";

export type { FriendshipDeleteFailureReason };

export async function deleteFriendshipWithGuard(
  tx: PrismaTransaction,
  pair: FriendshipPair,
  uid: string,
  guard: FriendshipDeleteGuard,
): Promise<
  | { ok: true }
  | { ok: false; reason: FriendshipDeleteFailureReason }
> {
  const deleted = await tx.friendship.deleteMany({
    where: {
      userLow: pair.userLow,
      userHigh: pair.userHigh,
      status: guard.status,
      ...(guard.mustBeRequester ? { requestedBy: uid } : {}),
      ...(guard.mustNotBeRequester ? { requestedBy: { not: uid } } : {}),
    },
  });

  if (deleted.count === 1) {
    return { ok: true };
  }

  const friendship = await tx.friendship.findUnique({
    where: { userLow_userHigh: pair },
    select: { status: true, requestedBy: true },
  });

  return {
    ok: false,
    reason: classifyFriendshipDeleteFailure(friendship, uid, guard),
  };
}
