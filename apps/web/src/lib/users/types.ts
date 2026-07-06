import type { z } from "zod";

import { meProfileSchema, userSchema } from "@/lib/api/schemas/user";

/** Flat user shape from POST/PATCH /users, POST /users/provision, and partial GET /me reads. */
export type UserProfile = z.infer<typeof userSchema>;

/** GET /api/v1/me response including mypage counts. */
export type MeProfile = z.infer<typeof meProfileSchema>;

export { meProfileSchema, userSchema };
