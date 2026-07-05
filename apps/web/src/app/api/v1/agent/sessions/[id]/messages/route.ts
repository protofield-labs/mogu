import { z } from "zod";

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

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return validationErrorResponse("Invalid JSON");
    }

    const parsed = messageBodySchema.safeParse(body);
    if (!parsed.success) {
      return validationErrorResponse("Invalid request body");
    }

    try {
      const agentMessage = await sendAgentMessage({
        userId: uid,
        sessionId,
        text: parsed.data.text,
        chips: parsed.data.chips,
      });
      return Response.json(agentMessage);
    } catch (error) {
      if (error instanceof AgentEngineNotConfiguredError) {
        return apiErrorResponse(
          "internal",
          "Agent Engine is not configured",
          503,
        );
      }
      if (error instanceof AgentSessionNotFoundError) {
        return notFoundResponse("Agent session not found");
      }
      if (error instanceof AgentSessionForbiddenError) {
        return forbiddenResponse("Agent session forbidden");
      }
      if (error instanceof AgentSessionError) {
        return apiErrorResponse("internal", error.message, 502);
      }
      throw error;
    }
  });
}
