import { getUserByUid } from "@/lib/dal/users";
import { notFoundResponse, requireAuth } from "@/lib/auth/require-auth";

export async function GET(request: Request): Promise<Response> {
  const auth = await requireAuth(request);
  if (auth instanceof Response) {
    return auth;
  }

  const user = await getUserByUid(auth.uid);
  if (!user) {
    return notFoundResponse();
  }

  return Response.json({ user });
}
