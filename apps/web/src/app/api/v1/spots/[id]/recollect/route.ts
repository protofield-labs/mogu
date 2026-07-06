import { z } from "zod";

import { uuidRouteParamsSchema } from "@/lib/api/schemas/common";
import {
  forbiddenResponse,
  notFoundResponse,
  validationErrorResponse,
  withAuthRoute,
} from "@/lib/auth/require-auth";
import { recollectSpot } from "@/lib/dal/spots";

const recollectBodySchema = z.object({
  targetCollectionId: z.string().uuid(),
});

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function POST(
  request: Request,
  { params }: RouteParams,
): Promise<Response> {
  const parsedParams = uuidRouteParamsSchema.safeParse(await params);
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

    const parsedBody = recollectBodySchema.safeParse(body);
    if (!parsedBody.success) {
      return validationErrorResponse("Invalid request body");
    }

    const result = await recollectSpot(
      uid,
      parsedParams.data.id,
      parsedBody.data.targetCollectionId,
    );

    if (!result.ok) {
      return result.reason === "forbidden"
        ? forbiddenResponse("Cannot recollect into this collection")
        : notFoundResponse("Spot not found");
    }

    return Response.json(result.spot);
  });
}
