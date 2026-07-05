import { validationErrorResponse, withAuthRoute } from "@/lib/auth/require-auth";
import { listFeed } from "@/lib/dal/feed";

export async function GET(request: Request): Promise<Response> {
  return withAuthRoute(request, async (req, { uid }) => {
    const cursor = new URL(req.url).searchParams.get("cursor");
    const page = await listFeed(uid, cursor);
    if (page === null) {
      return validationErrorResponse("Invalid cursor");
    }

    return Response.json(page);
  });
}
