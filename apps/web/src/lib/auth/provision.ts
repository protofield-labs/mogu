"use client";

import type { User } from "firebase/auth";

import { userSchema } from "@/lib/users/types";
import type { UserProfile } from "@/lib/users/types";
import { authFetch } from "./auth-fetch";
import { resolveDisplayName } from "./display-name";

/** Idempotent users row create via Route Handler (#14, #17). */
export async function provisionUser(
  user: User,
  displayNameOverride?: string,
): Promise<UserProfile> {
  const displayName = resolveDisplayName(user, displayNameOverride);
  const response = await authFetch("/api/v1/users/provision", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ displayName }),
  });

  if (!response.ok) {
    throw new Error(`Provisioning failed (${response.status})`);
  }

  return userSchema.parse(await response.json());
}
