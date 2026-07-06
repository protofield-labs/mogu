import { Prisma } from "@prisma/client";

import {
  notFoundResponse,
  validationErrorResponse,
  withAuthRoute,
} from "@/lib/auth/require-auth";
import { updateUserProfile } from "@/lib/dal/users";
import {
  normalizeAvatarColor,
  profileBodySchema,
} from "@/lib/users/profile-schema";

export async function patchProfile(request: Request): Promise<Response> {
  return withAuthRoute(request, async (req, { uid }) => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return validationErrorResponse("Invalid JSON");
    }

    const parsed = profileBodySchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse("Invalid request body");
    }

    try {
      const user = await updateUserProfile(
        uid,
        parsed.data.displayName,
        normalizeAvatarColor(parsed.data.avatarColor),
      );
      return Response.json(user);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        return notFoundResponse();
      }
      throw error;
    }
  });
}
