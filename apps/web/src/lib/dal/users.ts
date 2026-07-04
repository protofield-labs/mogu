import "server-only";

import { withRls } from "@/lib/db/rls";

export type UserDto = {
  firebaseUid: string;
  displayName: string;
  avatarColor: string | null;
  createdAt: string;
};

function toUserDto(user: {
  firebaseUid: string;
  displayName: string;
  avatarColor: string | null;
  createdAt: Date;
}): UserDto {
  return {
    firebaseUid: user.firebaseUid,
    displayName: user.displayName,
    avatarColor: user.avatarColor,
    createdAt: user.createdAt.toISOString(),
  };
}

/** Fetch the authenticated user's row (RLS-scoped). Returns null when absent. */
export async function getUserByUid(uid: string): Promise<UserDto | null> {
  const user = await withRls(uid, (tx) =>
    tx.user.findUnique({
      where: { firebaseUid: uid },
    }),
  );

  return user ? toUserDto(user) : null;
}

/**
 * Idempotent first-login provisioning (#14, #16).
 * ON CONFLICT DO NOTHING semantics via upsert with empty update.
 */
export async function provisionUser(
  uid: string,
  displayName: string,
): Promise<UserDto> {
  const user = await withRls(uid, (tx) =>
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
