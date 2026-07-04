import "server-only";

import { verifySession } from "./verify-session";

export function unauthorizedResponse(): Response {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

export function notFoundResponse(): Response {
  return Response.json({ error: "Not found" }, { status: 404 });
}

/** Returns uid or a 401 Response for Route Handlers. */
export async function requireAuth(
  request: Request,
): Promise<{ uid: string } | Response> {
  const session = await verifySession(request);
  if (!session) {
    return unauthorizedResponse();
  }
  return session;
}
