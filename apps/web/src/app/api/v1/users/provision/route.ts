import { z } from "zod";

import { provisionUser } from "@/lib/dal/users";
import { requireAuth } from "@/lib/auth/require-auth";

const provisionBodySchema = z.object({
  displayName: z.string().trim().min(1).max(100),
});

export async function POST(request: Request): Promise<Response> {
  const auth = await requireAuth(request);
  if (auth instanceof Response) {
    return auth;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = provisionBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const user = await provisionUser(auth.uid, parsed.data.displayName);
  return Response.json({ user }, { status: 201 });
}
