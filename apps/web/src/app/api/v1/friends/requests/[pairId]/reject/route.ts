import {
  conflictResponse,
  forbiddenResponse,
  notFoundResponse,
  validationErrorResponse,
  withAuthRoute,
} from "@/lib/auth/require-auth";
import { rejectFriendRequest } from "@/lib/dal/friends";

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
    const result = await rejectFriendRequest(uid, pairId);
    if (!result.ok) {
      if (result.reason === "invalid_pair_id") {
        return validationErrorResponse("Invalid pair id");
      }
      if (result.reason === "forbidden") {
        return forbiddenResponse("Cannot reject your own friend request");
      }
      if (result.reason === "conflict") {
        return conflictResponse("Friend request is not pending");
      }
      return notFoundResponse("Friend request not found");
    }

    return Response.json({ status: "rejected" });
  });
}
