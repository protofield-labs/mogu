import { parseSearchParams } from "@/lib/api/parse-json-body";
import { userSearchQuerySchema } from "@/lib/api/route-schemas";
import { withAuthRoute } from "@/lib/auth/require-auth";
import { searchUsers } from "@/lib/dal/users";

export async function GET(request: Request): Promise<Response> {
  return withAuthRoute(request, async (req, { uid }) => {
    const query = parseSearchParams(req.url, userSearchQuerySchema);
    if (!query.ok) {
      return query.response;
    }

    const users = await searchUsers(uid, query.data.q);
    return Response.json(users);
  });
}
