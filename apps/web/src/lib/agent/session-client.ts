import "server-only";

import { GoogleAuth } from "google-auth-library";

import { getAgentEngineConfig } from "./config";
import { AgentEngineNotConfiguredError, AgentSessionError } from "./errors";
import { parseSessionId } from "./session-id";

type CreateSessionResponse = {
  name?: string;
};

/**
 * Create a Vertex AI Agent Engine session (#43).
 * Conversation state lives in Agent Engine Sessions — not Cloud SQL.
 */
export async function createAgentSession(userId: string): Promise<string> {
  const config = getAgentEngineConfig();
  if (!config) {
    throw new AgentEngineNotConfiguredError();
  }

  const auth = new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await auth.getClient();
  const url = `https://${config.location}-aiplatform.googleapis.com/v1/${config.orchestratorResourceName}/sessions`;

  const response = await client.request<CreateSessionResponse>({
    url,
    method: "POST",
    data: {
      session: {
        displayName: `mogu-${userId}`,
      },
    },
  });

  const sessionResourceName = response.data.name;
  if (!sessionResourceName) {
    throw new AgentSessionError("Vertex AI Session API returned no session name");
  }

  return parseSessionId(sessionResourceName);
}
