import {
  notFoundResponse,
  withAuthRoute,
} from "@/lib/auth/require-auth";
import { AgentSessionNotFoundError } from "@/lib/agent/errors";
import { getAgentSession } from "@/lib/agent/session-client";
import { getAgentConsultation } from "@/lib/dal/agent-consultations";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function GET(
  request: Request,
  { params }: RouteParams,
): Promise<Response> {
  const { id } = await params;

  return withAuthRoute(request, async (_req, { uid }) => {
    const consultation = await getAgentConsultation(uid, id);
    if (!consultation) {
      return notFoundResponse("Consultation not found");
    }

    let resumable = false;
    try {
      await getAgentSession(consultation.vertexSessionId);
      resumable = true;
    } catch (error) {
      if (!(error instanceof AgentSessionNotFoundError)) {
        throw error;
      }
    }

    return Response.json({ ...consultation, resumable });
  });
}
