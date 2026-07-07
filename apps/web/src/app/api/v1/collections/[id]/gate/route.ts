import { parseRouteParams } from "@/lib/api/parse-json-body";
import { uuidRouteParamsSchema } from "@/lib/api/route-schemas";
import {
  notFoundResponse,
  validationErrorResponse,
  withAuthRoute,
} from "@/lib/auth/require-auth";
import { getCollectionShareGate } from "@/lib/dal/share-gate";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function GET(
  request: Request,
  { params }: RouteParams,
): Promise<Response> {
  const route = await parseRouteParams(params, uuidRouteParamsSchema);
  if (!route.ok) {
    return validationErrorResponse("Invalid collection id");
  }

  return withAuthRoute(request, async (_req, { uid }) => {
    const gate = await getCollectionShareGate(uid, route.data.id);
    if (!gate) {
      return notFoundResponse("Collection gate not available");
    }

    return Response.json(gate);
  });
}
