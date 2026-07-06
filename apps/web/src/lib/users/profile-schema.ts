import { z } from "zod";

import {
  DEFAULT_AVATAR_COLOR,
  ONBOARDING_AVATAR_COLORS,
} from "@/lib/user-profile";

export const profileBodySchema = z.object({
  displayName: z.string().trim().min(1).max(100),
  avatarColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .refine((color) => color !== DEFAULT_AVATAR_COLOR)
    .refine((color) =>
      (ONBOARDING_AVATAR_COLORS as readonly string[]).includes(
        color.toUpperCase(),
      ),
    ),
});

export type ProfileBody = z.infer<typeof profileBodySchema>;

export function normalizeAvatarColor(color: string): string {
  return color.toUpperCase();
}
