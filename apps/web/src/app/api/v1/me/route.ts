import { notFoundResponse, withAuthRoute } from "@/lib/auth/require-auth";
import { getMeByUid } from "@/lib/dal/users";

export async function GET(request: Request): Promise<Response> {
  return withAuthRoute(request, async (_request, { uid }) => {
    const me = await getMeByUid(uid);
    if (!me) {
      return notFoundResponse();
    }

    return Response.json(me);
  });
}
