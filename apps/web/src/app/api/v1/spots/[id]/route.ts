import { z } from "zod";

import {
  forbiddenResponse,
  notFoundResponse,
  validationErrorResponse,
  withAuthRoute,
} from "@/lib/auth/require-auth";
import { deleteSpot, updateSpot } from "@/lib/dal/spots";
import { updateSpotBodySchema } from "@/lib/spots/schemas";
import { resolveBucketName, validatePhotoUrls } from "@/lib/storage/photo-url";

const routeParamsSchema = z.object({
  id: z.string().uuid(),
});

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

export async function PATCH(
  request: Request,
  { params }: RouteParams,
): Promise<Response> {
  const parsedParams = routeParamsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return validationErrorResponse("Invalid spot id");
  }

  return withAuthRoute(request, async (req, { uid }) => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return validationErrorResponse("Invalid JSON");
    }

    const parsedBody = updateSpotBodySchema.safeParse(body);
    if (!parsedBody.success) {
      return validationErrorResponse("Invalid request body");
    }

    if (!validateSpotPhotoUrls(parsedBody.data.photoUrls, uid)) {
      return validationErrorResponse("Invalid photoUrls");
    }

    const result = await updateSpot(uid, parsedParams.data.id, parsedBody.data);
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
  const parsedParams = routeParamsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return validationErrorResponse("Invalid spot id");
  }

  return withAuthRoute(request, async (_req, { uid }) => {
    const result = await deleteSpot(uid, parsedParams.data.id);
    if (!result.ok) {
      return result.reason === "forbidden"
        ? forbiddenResponse("Cannot delete this spot")
        : notFoundResponse("Spot not found");
    }

    return new Response(null, { status: 204 });
  });
}
