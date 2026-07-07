import { withAuthRoute } from "@/lib/auth/require-auth";
import { listFlagEvents } from "@/lib/dal/flags";

export async function GET(request: Request): Promise<Response> {
  return withAuthRoute(request, async (_request, { uid }) => {
    const events = await listFlagEvents(uid);
    return Response.json(events);
  });
}
