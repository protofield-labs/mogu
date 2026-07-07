import { reorderCollectionsBodySchema } from "@/lib/api/schemas/collection";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import {
  forbiddenResponse,
  notFoundResponse,
  validationErrorResponse,
  withAuthRoute,
} from "@/lib/auth/require-auth";
import { reorderCollections } from "@/lib/dal/collections";

export async function PATCH(request: Request): Promise<Response> {
  return withAuthRoute(request, async (req, { uid }) => {
    const parsed = await parseJsonBody(req, reorderCollectionsBodySchema);
    if (!parsed.ok) {
      return parsed.response;
    }

    const result = await reorderCollections(uid, parsed.data.orderedIds);
    if (!result.ok) {
      return result.reason === "forbidden"
        ? forbiddenResponse("Invalid collection order")
        : notFoundResponse("Collection not found");
    }

    return Response.json(result.value);
  });
}
