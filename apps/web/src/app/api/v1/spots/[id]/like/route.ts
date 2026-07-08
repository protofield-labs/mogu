import { parseRouteParams } from "@/lib/api/parse-json-body";
import { uuidRouteParamsSchema } from "@/lib/api/route-schemas";
import {
  notFoundResponse,
  validationErrorResponse,
  withAuthRoute,
} from "@/lib/auth/require-auth";
import { likeSpot, unlikeSpot } from "@/lib/dal/spot-likes";

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

  return withAuthRoute(request, async (_req, { uid }) => {
    const result = await likeSpot(uid, route.data.id);
    if (!result.ok) {
      return notFoundResponse("Spot not found");
    }

    return new Response(null, { status: 204 });
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
    const result = await unlikeSpot(uid, route.data.id);
    if (!result.ok) {
      return notFoundResponse("Spot not found");
    }

    return new Response(null, { status: 204 });
  });
}
