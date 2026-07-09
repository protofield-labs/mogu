import { Prisma } from "@prisma/client";

import { parseJsonBody } from "@/lib/api/parse-json-body";
import {
  notFoundResponse,
  validationErrorResponse,
  withAuthRoute,
} from "@/lib/auth/require-auth";
import { updateUserProfile } from "@/lib/dal/users";
import {
  resolveBucketName,
  validateOwnedPhotoUrl,
} from "@/lib/storage/photo-url";
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

    const { displayName, avatarColor, avatarUrl } = parsed.data;
    if (
      typeof avatarUrl === "string" &&
      !validateOwnedPhotoUrl(avatarUrl, uid, resolveBucketName())
    ) {
      return validationErrorResponse("Invalid avatarUrl");
    }

    try {
      const user = await updateUserProfile(
        uid,
        displayName,
        normalizeAvatarColor(avatarColor),
        avatarUrl,
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
