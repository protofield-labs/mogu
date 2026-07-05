import { z } from "zod";

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
    const { searchParams } = new URL(req.url);
    const box = searchParams.get("box");
    if (box !== "in" && box !== "out") {
      return validationErrorResponse("Query parameter box must be in or out");
    }

    const requests = await listFriendRequests(uid, box);
    return Response.json(requests);
  });
}

export async function POST(request: Request): Promise<Response> {
  return withAuthRoute(request, async (req, { uid }) => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return validationErrorResponse("Invalid JSON");
    }

    const parsed = friendRequestBodySchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse("Invalid request body");
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
