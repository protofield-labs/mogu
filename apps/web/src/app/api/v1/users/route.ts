import { parseJsonBody } from "@/lib/api/parse-json-body";
import { withAuthRoute } from "@/lib/auth/require-auth";
import { upsertOnboardingUser } from "@/lib/dal/users";
import {
  normalizeAvatarColor,
  profileBodySchema,
} from "@/lib/users/profile-schema";

export async function POST(request: Request): Promise<Response> {
  return withAuthRoute(request, async (req, { uid }) => {
    const parsed = await parseJsonBody(req, profileBodySchema);
    if (!parsed.ok) {
      return parsed.response;
    }

    const user = await upsertOnboardingUser(
      uid,
      parsed.data.displayName,
      normalizeAvatarColor(parsed.data.avatarColor),
    );

    return Response.json(user);
  });
}
