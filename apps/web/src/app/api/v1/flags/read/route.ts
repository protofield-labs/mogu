import { parseJsonBodyOrEmpty } from "@/lib/api/parse-json-body";
import { readFlagsBodySchema } from "@/lib/api/route-schemas";
import { withAuthRoute } from "@/lib/auth/require-auth";
import { markFlagsRead } from "@/lib/dal/flags";

export async function POST(request: Request): Promise<Response> {
  return withAuthRoute(request, async (req, { uid }) => {
    const parsed = await parseJsonBodyOrEmpty(req, readFlagsBodySchema);
    if (!parsed.ok) {
      return parsed.response;
    }

    const updated = await markFlagsRead(uid, parsed.data.ids);
    return Response.json({ updated });
  });
}
