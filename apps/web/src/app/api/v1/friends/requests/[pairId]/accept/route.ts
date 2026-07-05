import {
  forbiddenResponse,
  notFoundResponse,
  validationErrorResponse,
  withAuthRoute,
} from "@/lib/auth/require-auth";
import { acceptFriendRequest } from "@/lib/dal/friends";

type RouteParams = {
  params: Promise<{
    pairId: string;
  }>;
};

export async function POST(
  request: Request,
  { params }: RouteParams,
): Promise<Response> {
  const { pairId } = await params;

  return withAuthRoute(request, async (_request, { uid }) => {
    const result = await acceptFriendRequest(uid, pairId);
    if (!result.ok) {
      if (result.reason === "invalid_pair_id") {
        return validationErrorResponse("Invalid pair id");
      }
      if (result.reason === "forbidden") {
        return forbiddenResponse("Cannot accept your own friend request");
      }
      return notFoundResponse("Friend request not found");
    }

    return Response.json(result.request);
  });
}
