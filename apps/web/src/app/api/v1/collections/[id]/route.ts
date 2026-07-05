import { z } from "zod";

import {
  notFoundResponse,
  validationErrorResponse,
  withAuthRoute,
} from "@/lib/auth/require-auth";
import {
  deleteCollection,
  getCollectionDetail,
  updateCollection,
} from "@/lib/dal/collections";

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

    const collection = await updateCollection(uid, id, parsed.data);
    if (!collection) {
      return notFoundResponse("Collection not found");
    }

    return Response.json(collection);
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
    const deleted = await deleteCollection(uid, id);
    if (!deleted) {
      return notFoundResponse("Collection not found");
    }

    return new Response(null, { status: 204 });
  });
}
