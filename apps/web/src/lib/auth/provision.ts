"use client";

import type { User } from "firebase/auth";

import { authFetch } from "./auth-fetch";
import { resolveDisplayName } from "./display-name";

type ProvisionResponse = {
  user: {
    firebaseUid: string;
    displayName: string;
    avatarColor: string;
    createdAt: string;
  };
};

/** Idempotent users row create via Route Handler (#14, #17). */
export async function provisionUser(
  user: User,
  displayNameOverride?: string,
): Promise<ProvisionResponse["user"]> {
  const displayName = resolveDisplayName(user, displayNameOverride);
  const response = await authFetch("/api/v1/users/provision", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ displayName }),
  });

  if (!response.ok) {
    throw new Error(`Provisioning failed (${response.status})`);
  }

  const data = (await response.json()) as ProvisionResponse;
  return data.user;
}
