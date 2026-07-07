import { parseJsonBody } from "@/lib/api/parse-json-body";
import { syncAgentConsultationBodySchema } from "@/lib/api/schemas/agent-consultations";
import {
  validationErrorResponse,
  withAuthRoute,
} from "@/lib/auth/require-auth";
import { assertAgentSessionOwnership } from "@/lib/agent/session-client";
import { isValidSessionId } from "@/lib/agent/session-id";
import { syncAgentConsultationEntries } from "@/lib/dal/agent-consultations";

export async function PUT(request: Request): Promise<Response> {
  return withAuthRoute(request, async (req, { uid }) => {
    const parsed = await parseJsonBody(req, syncAgentConsultationBodySchema);
    if (!parsed.ok) {
      return parsed.response;
    }

    const { sessionId, entries } = parsed.data;
    if (!isValidSessionId(sessionId)) {
      return validationErrorResponse("Invalid session id");
    }

    await assertAgentSessionOwnership(uid, sessionId);
    await syncAgentConsultationEntries(uid, sessionId, entries);
    return new Response(null, { status: 204 });
  });
}
