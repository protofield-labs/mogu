import { withAuthRoute } from "@/lib/auth/require-auth";
import { listFriends } from "@/lib/dal/friends";

export async function GET(request: Request): Promise<Response> {
  return withAuthRoute(request, async (_request, { uid }) => {
    const friends = await listFriends(uid);
    return Response.json(friends);
  });
}
