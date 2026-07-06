import { createCollectionBodySchema } from "@/lib/api/schemas/collection";
import { parseJsonBody, parseSearchParams } from "@/lib/api/parse-json-body";
import {
  collectionsListQuerySchema,
  resolveCollectionsOwnerId,
} from "@/lib/api/route-schemas";
import { withAuthRoute } from "@/lib/auth/require-auth";
import {
  createCollection,
  listCollections,
} from "@/lib/dal/collections";

export async function GET(request: Request): Promise<Response> {
  return withAuthRoute(request, async (req, { uid }) => {
    const query = parseSearchParams(req.url, collectionsListQuerySchema);
    if (!query.ok) {
      return query.response;
    }

    const ownerId = resolveCollectionsOwnerId(query.data.ownerId, uid);
    const collections = await listCollections(uid, ownerId);
    return Response.json(collections);
  });
}

export async function POST(request: Request): Promise<Response> {
  return withAuthRoute(request, async (req, { uid }) => {
    const parsed = await parseJsonBody(req, createCollectionBodySchema);
    if (!parsed.ok) {
      return parsed.response;
    }

    const collection = await createCollection(uid, parsed.data);
    return Response.json(collection);
  });
}
