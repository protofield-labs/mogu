import { notFoundResponse, withAuthRoute } from "@/lib/auth/require-auth";
import { getMeByUid } from "@/lib/dal/users";
import { patchProfile } from "@/lib/users/patch-profile-handler";

export async function GET(request: Request): Promise<Response> {
  return withAuthRoute(request, async (_request, { uid }) => {
    const me = await getMeByUid(uid);
    if (!me) {
      return notFoundResponse();
    }

    return Response.json(me);
  });
}

export async function PATCH(request: Request): Promise<Response> {
  return patchProfile(request);
}
