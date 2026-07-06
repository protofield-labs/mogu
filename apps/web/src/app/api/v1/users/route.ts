import {
  validationErrorResponse,
  withAuthRoute,
} from "@/lib/auth/require-auth";
import { upsertOnboardingUser } from "@/lib/dal/users";
import {
  normalizeAvatarColor,
  profileBodySchema,
} from "@/lib/users/profile-schema";

export async function POST(request: Request): Promise<Response> {
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

    const user = await upsertOnboardingUser(
      uid,
      parsed.data.displayName,
      normalizeAvatarColor(parsed.data.avatarColor),
    );

    return Response.json(user);
  });
}
