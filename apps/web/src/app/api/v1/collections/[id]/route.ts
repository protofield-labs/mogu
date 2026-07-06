import { updateCollectionBodySchema } from "@/lib/api/schemas/collection";
import { parseJsonBody, parseRouteParams } from "@/lib/api/parse-json-body";
import { uuidRouteParamsSchema } from "@/lib/api/route-schemas";
import {
  forbiddenResponse,
  notFoundResponse,
  validationErrorResponse,
  withAuthRoute,
} from "@/lib/auth/require-auth";
import {
  deleteCollection,
  getCollectionDetail,
  updateCollection,
} from "@/lib/dal/collections";
import { resolveBucketName, validateOwnedPhotoUrl } from "@/lib/storage/photo-url";

function validateOwnedCoverUrl(url: string, uid: string): boolean {
  try {
    return validateOwnedPhotoUrl(url, uid, resolveBucketName());
  } catch {
    return false;
  }
}

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
    const collection = await getCollectionDetail(uid, route.data.id);
    if (!collection) {
      return notFoundResponse("Collection not found");
    }

    return Response.json(collection);
  });
}

export async function PATCH(
  request: Request,
  { params }: RouteParams,
): Promise<Response> {
  const route = await parseRouteParams(params, uuidRouteParamsSchema);
  if (!route.ok) {
    return validationErrorResponse("Invalid collection id");
  }

  return withAuthRoute(request, async (req, { uid }) => {
    const parsed = await parseJsonBody(req, updateCollectionBodySchema);
    if (!parsed.ok) {
      return parsed.response;
    }

    if (
      parsed.data.coverUrl &&
      !validateOwnedCoverUrl(parsed.data.coverUrl, uid)
    ) {
      return validationErrorResponse("Invalid coverUrl");
    }

    const result = await updateCollection(uid, route.data.id, parsed.data);
    if (!result.ok) {
      return result.reason === "forbidden"
        ? forbiddenResponse("Only the owner can update this collection")
        : notFoundResponse("Collection not found");
    }

    return Response.json(result.value);
  });
}

export async function DELETE(
  request: Request,
  { params }: RouteParams,
): Promise<Response> {
  const route = await parseRouteParams(params, uuidRouteParamsSchema);
  if (!route.ok) {
    return validationErrorResponse("Invalid collection id");
  }

  return withAuthRoute(request, async (_req, { uid }) => {
    const result = await deleteCollection(uid, route.data.id);
    if (!result.ok) {
      return result.reason === "forbidden"
        ? forbiddenResponse("Only the owner can delete this collection")
        : notFoundResponse("Collection not found");
    }

    return new Response(null, { status: 204 });
  });
}
