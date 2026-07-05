import "server-only";

import { withAuthRls } from "@/lib/auth/with-auth-rls";

export type UserDto = {
  id: string;
  firebaseUid: string;
  displayName: string;
  avatarColor: string;
  createdAt: string;
};

export type MeDto = UserDto & {
  counts: {
    collections: number;
    spots: number;
    friends: number;
  };
};

function toUserDto(user: {
  firebaseUid: string;
  displayName: string;
  avatarColor: string;
  createdAt: Date;
}): UserDto {
  return {
    id: user.firebaseUid,
    firebaseUid: user.firebaseUid,
    displayName: user.displayName,
    avatarColor: user.avatarColor,
    createdAt: user.createdAt.toISOString(),
  };
}

/** Fetch the authenticated user's row (RLS-scoped). Returns null when absent. */
export async function getUserByUid(uid: string): Promise<UserDto | null> {
  const user = await withAuthRls(uid, (tx) =>
    tx.user.findUnique({
      where: { firebaseUid: uid },
    }),
  );

  return user ? toUserDto(user) : null;
}

/** Fetch the authenticated user's profile plus mypage counts (RLS-scoped). */
export async function getMeByUid(uid: string): Promise<MeDto | null> {
  const result = await withAuthRls(uid, async (tx) => {
    const user = await tx.user.findUnique({
      where: { firebaseUid: uid },
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
