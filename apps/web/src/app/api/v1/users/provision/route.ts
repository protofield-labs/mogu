import { parseJsonBody } from "@/lib/api/parse-json-body";
import { provisionBodySchema } from "@/lib/api/route-schemas";
import { withAuthRoute } from "@/lib/auth/require-auth";
import { provisionUser } from "@/lib/dal/users";

export async function POST(request: Request): Promise<Response> {
  return withAuthRoute(request, async (req, { uid }) => {
    const parsed = await parseJsonBody(req, provisionBodySchema);
    if (!parsed.ok) {
      return parsed.response;
    }

    const user = await provisionUser(uid, parsed.data.displayName);
    return Response.json(user, { status: 201 });
  });
}
