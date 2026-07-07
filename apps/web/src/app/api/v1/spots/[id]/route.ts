import { parseJsonBody, parseRouteParams } from "@/lib/api/parse-json-body";
import { uuidRouteParamsSchema } from "@/lib/api/route-schemas";
import {
  forbiddenResponse,
  notFoundResponse,
  validationErrorResponse,
  withAuthRoute,
} from "@/lib/auth/require-auth";
import { deleteSpot, getSpotDetail, updateSpot } from "@/lib/dal/spots";
import { updateSpotBodySchema } from "@/lib/spots/schemas";
import { resolveBucketName, validatePhotoUrls } from "@/lib/storage/photo-url";

type RouteParams = {
  params: Promise<{ id: string }>;
};

function validateSpotPhotoUrls(urls: string[] | undefined, uid: string): boolean {
  if (!urls || urls.length === 0) {
    return true;
  }
  try {
    return validatePhotoUrls(urls, uid, resolveBucketName());
  } catch {
    return false;
  }
}

export async function GET(
  request: Request,
  { params }: RouteParams,
): Promise<Response> {
  const route = await parseRouteParams(params, uuidRouteParamsSchema);
  if (!route.ok) {
    return validationErrorResponse("Invalid spot id");
  }

  return withAuthRoute(request, async (_req, { uid }) => {
    const spot = await getSpotDetail(uid, route.data.id);
    if (!spot) {
      return notFoundResponse("Spot not found");
    }

    return Response.json(spot);
  });
}

export async function PATCH(
  request: Request,
  { params }: RouteParams,
): Promise<Response> {
  const route = await parseRouteParams(params, uuidRouteParamsSchema);
  if (!route.ok) {
    return validationErrorResponse("Invalid spot id");
  }

  return withAuthRoute(request, async (req, { uid }) => {
    const parsed = await parseJsonBody(req, updateSpotBodySchema);
    if (!parsed.ok) {
      return parsed.response;
    }

    if (!validateSpotPhotoUrls(parsed.data.photoUrls, uid)) {
      return validationErrorResponse("Invalid photoUrls");
    }

    const result = await updateSpot(uid, route.data.id, parsed.data);
    if (!result.ok) {
      return result.reason === "forbidden"
        ? forbiddenResponse("Cannot update this spot")
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
    const result = await deleteSpot(uid, route.data.id);
    if (!result.ok) {
      return result.reason === "forbidden"
        ? forbiddenResponse("Cannot delete this spot")
        : notFoundResponse("Spot not found");
    }

    return new Response(null, { status: 204 });
  });
}
