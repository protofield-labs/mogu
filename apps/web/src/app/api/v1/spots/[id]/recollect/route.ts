import { parseJsonBody, parseRouteParams } from "@/lib/api/parse-json-body";
import {
  recollectBodySchema,
  uuidRouteParamsSchema,
} from "@/lib/api/route-schemas";
import {
  forbiddenResponse,
  notFoundResponse,
  validationErrorResponse,
  withAuthRoute,
} from "@/lib/auth/require-auth";
import { recollectSpot, unrecollectSpot } from "@/lib/dal/spots";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function POST(
  request: Request,
  { params }: RouteParams,
): Promise<Response> {
  const route = await parseRouteParams(params, uuidRouteParamsSchema);
  if (!route.ok) {
    return validationErrorResponse("Invalid spot id");
  }

  return withAuthRoute(request, async (req, { uid }) => {
    const parsed = await parseJsonBody(req, recollectBodySchema);
    if (!parsed.ok) {
      return parsed.response;
    }

    const result = await recollectSpot(
      uid,
      route.data.id,
      parsed.data.targetCollectionId,
    );

    if (!result.ok) {
      return result.reason === "forbidden"
        ? forbiddenResponse("Cannot recollect into this collection")
        : notFoundResponse("Spot not found");
    }

    return Response.json(result.spot);
  });
}

export async function DELETE(
  request: Request,
  { params }: RouteParams,
): Promise<Response> {
  const route = await parseRouteParams(params, uuidRouteParamsSchema);
  if (!route.ok) {
    return validationErrorResponse("Invalid spot id");
  }

  return withAuthRoute(request, async (_req, { uid }) => {
    const result = await unrecollectSpot(uid, route.data.id);
    // savedCount: refreshed place-level circle count (null when there was
    // nothing to delete) so clients can sync their snapshots exactly.
    return Response.json({ savedCount: result.savedCount });
  });
}
