import { parseJsonBodyOrEmpty } from "@/lib/api/parse-json-body";
import { createAgentSessionBodySchema } from "@/lib/api/schemas/agent";
import {
  AgentEngineNotConfiguredError,
  AgentSessionError,
} from "@/lib/agent/errors";
import { seedAgentRecommendationContext } from "@/lib/agent/message-client";
import { createAgentSession } from "@/lib/agent/session-client";
import { createAgentConsultation } from "@/lib/dal/agent-consultations";
import {
  apiErrorResponse,
  withAuthRoute,
} from "@/lib/auth/require-auth";

export async function POST(request: Request): Promise<Response> {
  return withAuthRoute(request, async (req, { uid }) => {
    const parsed = await parseJsonBodyOrEmpty(req, createAgentSessionBodySchema);
    if (!parsed.ok) {
      return parsed.response;
    }

    try {
      const sessionId = await createAgentSession(uid);
      await createAgentConsultation(uid, sessionId);

      const context = parsed.data.recommendationContext;
      if (context) {
        await seedAgentRecommendationContext({
          userId: uid,
          sessionId,
          context,
        });
      }

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
