import "server-only";

import { withAuthRls } from "@/lib/auth/with-auth-rls";

export type UserDto = {
  id: string;
  displayName: string;
  avatarColor: string;
};

export type MeDto = UserDto & {
  counts: {
    collections: number;
    spots: number;
    friends: number;
  };
};

export function toUserDto(user: {
  firebaseUid: string;
  displayName: string;
  avatarColor: string;
}): UserDto {
  return {
    id: user.firebaseUid,
    displayName: user.displayName,
    avatarColor: user.avatarColor,
  };
}

export const userSelect = {
  firebaseUid: true,
  displayName: true,
  avatarColor: true,
} as const;

/** Fetch the authenticated user's profile plus mypage counts (RLS-scoped). */
export async function getMeByUid(uid: string): Promise<MeDto | null> {
  const result = await withAuthRls(uid, async (tx) => {
    const user = await tx.user.findUnique({
      where: { firebaseUid: uid },
      select: userSelect,
    });

    if (!user) {
      return null;
    }

    const [collections, spots, friends] = await Promise.all([
      tx.collection.count({ where: { ownerId: uid } }),
      tx.spot.count({ where: { addedBy: uid } }),
      tx.friendship.count({
        where: {
          status: "accepted",
          OR: [{ userLow: uid }, { userHigh: uid }],
        },
      }),
    ]);

    return {
      user,
      counts: { collections, spots, friends },
    };
  });

  if (!result) {
    return null;
  }

  return {
    ...toUserDto(result.user),
    counts: result.counts,
  };
}

export type MeBadgesDto = {
  pendingFriendRequests: number;
  unreadFlags: number;
};

/** Fetch lightweight badge counts for mypage/tab indicators. */
export async function getMeBadges(uid: string): Promise<MeBadgesDto> {
  return withAuthRls(uid, async (tx) => {
    const [pendingFriendRequests, unreadFlags] = await Promise.all([
      tx.friendship.count({
        where: {
          status: "pending",
          requestedBy: { not: uid },
          OR: [{ userLow: uid }, { userHigh: uid }],
        },
      }),
      tx.flag.count({
        where: {
          recipientId: uid,
          readAt: null,
        },
      }),
    ]);

    return { pendingFriendRequests, unreadFlags };
  });
}

export async function searchUsers(
  uid: string,
  query: string,
): Promise<UserDto[]> {
  const normalizedQuery = query.trim();
  if (normalizedQuery.length === 0) {
    return [];
  }

  const users = await withAuthRls(uid, (tx) =>
    tx.user.findMany({
      where: {
        firebaseUid: { not: uid },
        displayName: {
          contains: normalizedQuery,
          mode: "insensitive",
        },
      },
      select: userSelect,
      orderBy: [{ displayName: "asc" }, { firebaseUid: "asc" }],
      take: 20,
    }),
  );

  return users.map(toUserDto);
}

/**
 * Idempotent first-login provisioning (#14, #16).
 * ON CONFLICT DO NOTHING semantics via upsert with empty update.
 */
export async function provisionUser(
  uid: string,
  displayName: string,
): Promise<UserDto> {
  const user = await withAuthRls(uid, (tx) =>
    tx.user.upsert({
      where: { firebaseUid: uid },
      create: {
        firebaseUid: uid,
        displayName,
      },
      update: {},
    }),
  );

  return toUserDto(user);
}

/** Create or update onboarding profile fields for the authenticated user. */
export async function upsertOnboardingUser(
  uid: string,
  displayName: string,
  avatarColor: string,
): Promise<UserDto> {
  const user = await withAuthRls(uid, (tx) =>
    tx.user.upsert({
      where: { firebaseUid: uid },
      create: {
        firebaseUid: uid,
        displayName,
        avatarColor,
      },
      update: {
        displayName,
        avatarColor,
      },
    }),
  );

  return toUserDto(user);
}

/** Update profile fields for an existing user (#81). */
export async function updateUserProfile(
  uid: string,
  displayName: string,
  avatarColor: string,
): Promise<UserDto> {
  const user = await withAuthRls(uid, (tx) =>
    tx.user.update({
      where: { firebaseUid: uid },
      data: { displayName, avatarColor },
      select: userSelect,
    }),
  );
  return toUserDto(user);
}
