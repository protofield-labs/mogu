import {
  apiErrorResponse,
  withAuthRoute,
} from "@/lib/auth/require-auth";
import {
  AgentEngineNotConfiguredError,
  AgentSessionError,
} from "@/lib/agent/errors";
import { createAgentSession } from "@/lib/agent/session-client";

export async function POST(request: Request): Promise<Response> {
  return withAuthRoute(request, async (_req, { uid }) => {
    try {
      const sessionId = await createAgentSession(uid);
      return Response.json({ sessionId });
    } catch (error) {
      if (error instanceof AgentEngineNotConfiguredError) {
        return apiErrorResponse(
          "internal",
          "Agent Engine is not configured",
          503,
        );
      }
      if (error instanceof AgentSessionError) {
        return apiErrorResponse("internal", error.message, 502);
      }
      throw error;
    }
  });
}
