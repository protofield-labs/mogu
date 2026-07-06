"use client";

import { apiJson, apiJsonOrNull } from "@/lib/api/browser-client";
import { meProfileSchema, userSchema } from "@/lib/api/schemas/user";
import type { ProfileBody } from "@/lib/users/profile-schema";
import { z } from "zod";

export type UserProfile = z.infer<typeof userSchema>;

/** Profile lookup; null when the user row is not provisioned yet. */
export async function fetchUsersMe(): Promise<UserProfile | null> {
  const profile = await apiJsonOrNull(
    "/api/v1/me",
    meProfileSchema,
    "プロフィールを読み込めませんでした",
    { emptyStatuses: [404] },
  );
  if (!profile) {
    return null;
  }
  return {
    id: profile.id,
    displayName: profile.displayName,
    avatarColor: profile.avatarColor,
  };
}

export async function createUserProfile(body: ProfileBody): Promise<UserProfile> {
  return apiJson("/api/v1/users", userSchema, "プロフィールを保存できませんでした", {
    init: {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  });
}
