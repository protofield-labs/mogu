import { withAuthRoute } from "@/lib/auth/require-auth";
import { listAgentConsultations } from "@/lib/dal/agent-consultations";

export async function GET(request: Request): Promise<Response> {
  return withAuthRoute(request, async (_req, { uid }) => {
    const consultations = await listAgentConsultations(uid);
    return Response.json(consultations);
  });
}
