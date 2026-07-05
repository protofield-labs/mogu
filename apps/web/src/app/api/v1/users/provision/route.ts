import { z } from "zod";

import { provisionUser } from "@/lib/dal/users";
import {
  validationErrorResponse,
  withAuthRoute,
} from "@/lib/auth/require-auth";

const provisionBodySchema = z.object({
  displayName: z.string().trim().min(1).max(100),
});

export async function POST(request: Request): Promise<Response> {
  return withAuthRoute(request, async (req, { uid }) => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return validationErrorResponse("Invalid JSON");
    }

    const parsed = provisionBodySchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse("Invalid request body");
    }

    const user = await provisionUser(uid, parsed.data.displayName);
    return Response.json({ user }, { status: 201 });
  });
}
