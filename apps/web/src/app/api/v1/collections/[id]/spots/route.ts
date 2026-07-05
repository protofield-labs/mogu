import { z } from "zod";

import {
  forbiddenResponse,
  notFoundResponse,
  validationErrorResponse,
  withAuthRoute,
} from "@/lib/auth/require-auth";
import { createSpot } from "@/lib/dal/spots";
import { createSpotBodySchema } from "@/lib/spots/schemas";
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

export async function POST(
  request: Request,
  { params }: RouteParams,
): Promise<Response> {
  const parsedParams = routeParamsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return validationErrorResponse("Invalid collection id");
  }

  return withAuthRoute(request, async (req, { uid }) => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return validationErrorResponse("Invalid JSON");
    }

    const parsedBody = createSpotBodySchema.safeParse(body);
    if (!parsedBody.success) {
      return validationErrorResponse("Invalid request body");
    }

    if (!validateSpotPhotoUrls(parsedBody.data.photoUrls, uid)) {
      return validationErrorResponse("Invalid photoUrls");
    }

    const result = await createSpot(uid, parsedParams.data.id, parsedBody.data);
    if (!result.ok) {
      return result.reason === "forbidden"
        ? forbiddenResponse("Cannot add spots to this collection")
        : notFoundResponse("Collection not found");
    }

    return Response.json(result.spot);
  });
}
