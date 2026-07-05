import { z } from "zod";

import {
  validationErrorResponse,
  withAuthRoute,
} from "@/lib/auth/require-auth";
import {
  createCollection,
  listCollections,
} from "@/lib/dal/collections";

const collectionVisibilitySchema = z.enum(["friends", "secret"]);

const createCollectionBodySchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(240).optional(),
  visibility: collectionVisibilitySchema,
  theme: z.string().trim().max(80).optional(),
});

function resolveOwnerId(request: Request, uid: string): string {
  const { searchParams } = new URL(request.url);
  const ownerId = searchParams.get("ownerId");
  return !ownerId || ownerId === "me" ? uid : ownerId;
}

export async function GET(request: Request): Promise<Response> {
  return withAuthRoute(request, async (req, { uid }) => {
    const collections = await listCollections(uid, resolveOwnerId(req, uid));
    return Response.json(collections);
  });
}

export async function POST(request: Request): Promise<Response> {
  return withAuthRoute(request, async (req, { uid }) => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return validationErrorResponse("Invalid JSON");
    }

    const parsed = createCollectionBodySchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse("Invalid request body");
    }

    const collection = await createCollection(uid, parsed.data);
    return Response.json(collection);
  });
}
