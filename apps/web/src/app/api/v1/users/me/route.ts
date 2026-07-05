import { getUserByUid } from "@/lib/dal/users";
import { notFoundResponse, withAuthRoute } from "@/lib/auth/require-auth";

export async function GET(request: Request): Promise<Response> {
  return withAuthRoute(request, async (_request, { uid }) => {
    const user = await getUserByUid(uid);
    if (!user) {
      return notFoundResponse();
    }

    return Response.json({ user });
  });
}
