import { z } from "zod";

import {
  validationErrorResponse,
  withAuthRoute,
} from "@/lib/auth/require-auth";
import { markFlagsRead } from "@/lib/dal/flags";

const readFlagsBodySchema = z.object({
  ids: z.array(z.string().uuid()).optional(),
});

export async function POST(request: Request): Promise<Response> {
  return withAuthRoute(request, async (req, { uid }) => {
    let body: unknown = {};
    try {
      const text = await req.text();
      if (text.trim().length > 0) {
        body = JSON.parse(text);
      }
    } catch {
      return validationErrorResponse("Invalid JSON");
    }

    const parsed = readFlagsBodySchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse("Invalid request body");
    }

    const updated = await markFlagsRead(uid, parsed.data.ids);
    return Response.json({ updated });
  });
}
