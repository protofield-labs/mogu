import { parseSearchParams } from "@/lib/api/parse-json-body";
import { feedQuerySchema } from "@/lib/api/route-schemas";
import { validationErrorResponse, withAuthRoute } from "@/lib/auth/require-auth";
import { listFeed } from "@/lib/dal/feed";

export async function GET(request: Request): Promise<Response> {
  return withAuthRoute(request, async (req, { uid }) => {
    const query = parseSearchParams(req.url, feedQuerySchema);
    if (!query.ok) {
      return query.response;
    }

    const page = await listFeed(uid, query.data.cursor ?? null);
    if (page === null) {
      return validationErrorResponse("Invalid cursor");
    }

    return Response.json(page);
  });
}
