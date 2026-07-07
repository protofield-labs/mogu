import { parseRouteParams } from "@/lib/api/parse-json-body";
import { pairIdRouteParamsSchema } from "@/lib/api/route-schemas";
import {
  conflictResponse,
  forbiddenResponse,
  notFoundResponse,
  validationErrorResponse,
  withAuthRoute,
} from "@/lib/auth/require-auth";
import { cancelFriendRequest } from "@/lib/dal/friends";

type RouteParams = {
  params: Promise<{
    pairId: string;
  }>;
};

export async function DELETE(
  request: Request,
  { params }: RouteParams,
): Promise<Response> {
  const route = await parseRouteParams(params, pairIdRouteParamsSchema);
  if (!route.ok) {
    return validationErrorResponse("Invalid pair id");
  }

  return withAuthRoute(request, async (_request, { uid }) => {
    const result = await cancelFriendRequest(uid, route.data.pairId);
    if (!result.ok) {
      if (result.reason === "invalid_pair_id") {
        return validationErrorResponse("Invalid pair id");
      }
      if (result.reason === "forbidden") {
        return forbiddenResponse("Cannot cancel a request you did not send");
      }
      if (result.reason === "conflict") {
        return conflictResponse("Friend request is not pending");
      }
      return notFoundResponse("Friend request not found");
    }

    return new Response(null, { status: 204 });
  });
}
