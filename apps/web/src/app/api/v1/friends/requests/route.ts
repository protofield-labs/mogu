import { z } from "zod";

import { parseJsonBody, parseSearchParams } from "@/lib/api/parse-json-body";
import { friendRequestsQuerySchema } from "@/lib/api/route-schemas";
import {
  conflictResponse,
  notFoundResponse,
  validationErrorResponse,
  withAuthRoute,
} from "@/lib/auth/require-auth";
import { listFriendRequests, sendFriendRequest } from "@/lib/dal/friends";

const friendRequestBodySchema = z.object({
  toUserId: z.string().trim().min(1),
});

export async function GET(request: Request): Promise<Response> {
  return withAuthRoute(request, async (req, { uid }) => {
    const query = parseSearchParams(req.url, friendRequestsQuerySchema);
    if (!query.ok) {
      return query.response;
    }

    const requests = await listFriendRequests(uid, query.data.box);
    return Response.json(requests);
  });
}

export async function POST(request: Request): Promise<Response> {
  return withAuthRoute(request, async (req, { uid }) => {
    const parsed = await parseJsonBody(req, friendRequestBodySchema);
    if (!parsed.ok) {
      return parsed.response;
    }

    const result = await sendFriendRequest(uid, parsed.data.toUserId);
    if (!result.ok) {
      if (result.reason === "self") {
        return validationErrorResponse("Cannot send a friend request to yourself");
      }
      if (result.reason === "not_found") {
        return notFoundResponse("User not found");
      }
      return conflictResponse("Friend request already exists");
    }

    return Response.json(result.request);
  });
}
