import { parseJsonBody, parseRouteParams } from "@/lib/api/parse-json-body";
import { uuidRouteParamsSchema } from "@/lib/api/route-schemas";
import {
  forbiddenResponse,
  notFoundResponse,
  validationErrorResponse,
  withAuthRoute,
} from "@/lib/auth/require-auth";
import { createSpot } from "@/lib/dal/spots";
import { createSpotBodySchema } from "@/lib/spots/schemas";
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

export async function POST(
  request: Request,
  { params }: RouteParams,
): Promise<Response> {
  const route = await parseRouteParams(params, uuidRouteParamsSchema);
  if (!route.ok) {
    return validationErrorResponse("Invalid collection id");
  }

  return withAuthRoute(request, async (req, { uid }) => {
    const parsed = await parseJsonBody(req, createSpotBodySchema);
    if (!parsed.ok) {
      return parsed.response;
    }

    if (!validateSpotPhotoUrls(parsed.data.photoUrls, uid)) {
      return validationErrorResponse("Invalid photoUrls");
    }

    const result = await createSpot(uid, route.data.id, parsed.data);
    if (!result.ok) {
      return result.reason === "forbidden"
        ? forbiddenResponse("Cannot add spots to this collection")
        : notFoundResponse("Collection not found");
    }

    return Response.json(result.spot);
  });
}
