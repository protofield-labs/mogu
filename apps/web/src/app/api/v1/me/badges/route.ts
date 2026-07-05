import { withAuthRoute } from "@/lib/auth/require-auth";
import { getMeBadges } from "@/lib/dal/users";

export async function GET(request: Request): Promise<Response> {
  return withAuthRoute(request, async (_request, { uid }) => {
    const badges = await getMeBadges(uid);
    return Response.json(badges);
  });
}
