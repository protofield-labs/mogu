import "server-only";

import { GoogleAuth } from "google-auth-library";

import { getAgentEngineConfig } from "./config";
import { AgentEngineNotConfiguredError, AgentSessionError } from "./errors";
import { parseSessionId } from "./session-id";

type CreateSessionResponse = {
  done?: boolean;
  name?: string;
  response?: {
    name?: string;
  };
};

const auth = new GoogleAuth({
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});

function extractSessionResourceName(
  payload: CreateSessionResponse,
): string | undefined {
  if (payload.response?.name) {
    return payload.response.name;
  }

  const operationName = payload.name;
  if (!operationName) {
    return undefined;
  }

  const match = operationName.match(/^(.*\/sessions\/[^/]+)/);
  return match?.[1];
}

/**
 * Create a Vertex AI Agent Engine session (#43).
 * Conversation state lives in Agent Engine Sessions — not Cloud SQL.
 */
export async function createAgentSession(userId: string): Promise<string> {
  const config = getAgentEngineConfig();
  if (!config) {
    throw new AgentEngineNotConfiguredError();
  }

  const client = await auth.getClient();
  const url = `https://${config.location}-aiplatform.googleapis.com/v1/${config.orchestratorResourceName}/sessions`;

  const response = await client.request<CreateSessionResponse>({
    url,
    method: "POST",
    data: {
      userId,
    },
  });

  if (response.data.done === false) {
    throw new AgentSessionError("Vertex AI session creation did not complete");
  }

  const sessionResourceName = extractSessionResourceName(response.data);
  if (!sessionResourceName) {
    throw new AgentSessionError("Vertex AI Session API returned no session name");
  }

  return parseSessionId(sessionResourceName);
}
