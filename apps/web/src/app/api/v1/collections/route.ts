import {
  createCollectionBodySchema,
} from "@/lib/api/schemas/collection";
import {
  validationErrorResponse,
  withAuthRoute,
} from "@/lib/auth/require-auth";
import {
  createCollection,
  listCollections,
} from "@/lib/dal/collections";

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
