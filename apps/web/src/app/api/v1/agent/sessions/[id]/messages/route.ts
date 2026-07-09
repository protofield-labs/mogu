import { z } from "zod";

import { parseJsonBody } from "@/lib/api/parse-json-body";
import { sendAgentMessage } from "@/lib/agent/message-client";
import {
  AgentEngineNotConfiguredError,
  AgentSessionError,
  AgentSessionForbiddenError,
  AgentSessionNotFoundError,
} from "@/lib/agent/errors";
import { isValidSessionId } from "@/lib/agent/session-id";
import {
  apiErrorResponse,
  forbiddenResponse,
  notFoundResponse,
  validationErrorResponse,
  withAuthRoute,
} from "@/lib/auth/require-auth";

const messageBodySchema = z.object({
  text: z.string().trim().min(1).max(4000),
  chips: z.array(z.string().trim().min(1).max(100)).max(10).optional(),
  candidateSpot: z
    .object({
      spotId: z.string().min(1).max(100),
      placeId: z.string().min(1).max(200),
    })
    .optional(),
});

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function POST(
  request: Request,
  { params }: RouteParams,
): Promise<Response> {
  const { id: sessionId } = await params;

  return withAuthRoute(request, async (req, { uid }) => {
    if (!isValidSessionId(sessionId)) {
      return validationErrorResponse("Invalid session id");
    }

    const parsed = await parseJsonBody(req, messageBodySchema);
    if (!parsed.ok) {
      return parsed.response;
    }

    try {
      const agentMessage = await sendAgentMessage({
        userId: uid,
        sessionId,
        text: parsed.data.text,
        chips: parsed.data.chips,
        candidateSpot: parsed.data.candidateSpot,
      });
      return Response.json(agentMessage);
    } catch (error) {
      if (error instanceof AgentSessionNotFoundError) {
        return notFoundResponse("Agent session not found");
      }
      if (error instanceof AgentSessionForbiddenError) {
        return forbiddenResponse("Agent session access denied");
      }
      if (error instanceof AgentEngineNotConfiguredError) {
        return apiErrorResponse("internal", error.message, 503);
      }
      if (error instanceof AgentSessionError) {
        return apiErrorResponse("internal", error.message, 502);
      }
      throw error;
    }
  });
}
