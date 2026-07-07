import { parseRouteParams } from "@/lib/api/parse-json-body";
import { userIdRouteParamsSchema } from "@/lib/api/route-schemas";
import { notFoundResponse, withAuthRoute } from "@/lib/auth/require-auth";
import { getFriendProfile } from "@/lib/dal/users";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const route = await parseRouteParams(context.params, userIdRouteParamsSchema);
  if (!route.ok) {
    return route.response;
  }

  return withAuthRoute(request, async (_req, { uid }) => {
    const profile = await getFriendProfile(uid, route.data.id);
    if (!profile) {
      return notFoundResponse();
    }

    return Response.json(profile);
  });
}
