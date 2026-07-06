import { Prisma } from "@prisma/client";

import { parseJsonBody } from "@/lib/api/parse-json-body";
import {
  notFoundResponse,
  withAuthRoute,
} from "@/lib/auth/require-auth";
import { updateUserProfile } from "@/lib/dal/users";
import {
  normalizeAvatarColor,
  profileBodySchema,
} from "@/lib/users/profile-schema";

export async function patchProfile(request: Request): Promise<Response> {
  return withAuthRoute(request, async (req, { uid }) => {
    const parsed = await parseJsonBody(req, profileBodySchema);
    if (!parsed.ok) {
      return parsed.response;
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
