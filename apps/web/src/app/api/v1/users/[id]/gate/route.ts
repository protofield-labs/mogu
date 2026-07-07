import { parseRouteParams } from "@/lib/api/parse-json-body";
import { userIdRouteParamsSchema } from "@/lib/api/route-schemas";
import { notFoundResponse, withAuthRoute } from "@/lib/auth/require-auth";
import { getUserShareGate } from "@/lib/dal/share-gate";

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
    const gate = await getUserShareGate(uid, route.data.id);
    if (!gate) {
      return notFoundResponse();
    }

    return Response.json(gate);
  });
}
