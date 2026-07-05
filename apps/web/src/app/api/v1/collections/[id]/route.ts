import { z } from "zod";

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

const routeParamsSchema = z.object({
  id: z.string().uuid(),
});

const updateCollectionBodySchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    description: z.string().trim().max(240).nullable().optional(),
    coverUrl: z.string().trim().url().max(2048).nullable().optional(),
    visibility: z.enum(["friends", "secret"]).optional(),
    theme: z.string().trim().max(80).nullable().optional(),
  })
  .refine((body) => Object.keys(body).length > 0);

type RouteParams = {
  params: Promise<{ id: string }>;
};

async function parseId(params: RouteParams["params"]): Promise<string | null> {
  const parsed = routeParamsSchema.safeParse(await params);
  return parsed.success ? parsed.data.id : null;
}

export async function GET(
  request: Request,
  { params }: RouteParams,
): Promise<Response> {
  const id = await parseId(params);
  if (!id) {
    return validationErrorResponse("Invalid collection id");
  }

  return withAuthRoute(request, async (_req, { uid }) => {
    const collection = await getCollectionDetail(uid, id);
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
  const id = await parseId(params);
  if (!id) {
    return validationErrorResponse("Invalid collection id");
  }

  return withAuthRoute(request, async (req, { uid }) => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return validationErrorResponse("Invalid JSON");
    }

    const parsed = updateCollectionBodySchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse("Invalid request body");
    }

    if (
      parsed.data.coverUrl &&
      !validateOwnedCoverUrl(parsed.data.coverUrl, uid)
    ) {
      return validationErrorResponse("Invalid coverUrl");
    }

    const result = await updateCollection(uid, id, parsed.data);
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
  const id = await parseId(params);
  if (!id) {
    return validationErrorResponse("Invalid collection id");
  }

  return withAuthRoute(request, async (_req, { uid }) => {
    const result = await deleteCollection(uid, id);
    if (!result.ok) {
      return result.reason === "forbidden"
        ? forbiddenResponse("Only the owner can delete this collection")
        : notFoundResponse("Collection not found");
    }

    return new Response(null, { status: 204 });
  });
}
