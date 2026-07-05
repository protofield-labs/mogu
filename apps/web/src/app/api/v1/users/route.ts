import { z } from "zod";

import {
  validationErrorResponse,
  withAuthRoute,
} from "@/lib/auth/require-auth";
import { upsertOnboardingUser } from "@/lib/dal/users";
import {
  DEFAULT_AVATAR_COLOR,
  ONBOARDING_AVATAR_COLORS,
} from "@/lib/user-profile";

const createUserBodySchema = z.object({
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

export async function POST(request: Request): Promise<Response> {
  return withAuthRoute(request, async (req, { uid }) => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return validationErrorResponse("Invalid JSON");
    }

    const parsed = createUserBodySchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse("Invalid request body");
    }

    const user = await upsertOnboardingUser(
      uid,
      parsed.data.displayName,
      parsed.data.avatarColor.toUpperCase(),
    );

    return Response.json(user);
  });
}
