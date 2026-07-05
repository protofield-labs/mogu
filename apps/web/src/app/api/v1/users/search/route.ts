import {
  validationErrorResponse,
  withAuthRoute,
} from "@/lib/auth/require-auth";
import { searchUsers } from "@/lib/dal/users";

export async function GET(request: Request): Promise<Response> {
  return withAuthRoute(request, async (req, { uid }) => {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q")?.trim() ?? "";
    if (query.length === 0) {
      return validationErrorResponse("Query parameter q is required");
    }

    const users = await searchUsers(uid, query);
    return Response.json(users);
  });
}
