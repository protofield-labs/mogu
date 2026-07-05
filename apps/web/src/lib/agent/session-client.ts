import "server-only";

import {
  AgentSessionForbiddenError,
  AgentSessionNotFoundError,
  AgentSessionError,
} from "./errors";
import { parseSessionId } from "./session-id";
import {
  getAuthorizedClient,
  requireAgentEngineConfig,
  vertexApiBase,
} from "./vertex-client";

type CreateSessionResponse = {
  done?: boolean;
  name?: string;
  response?: {
    name?: string;
  };
};

type VertexSession = {
  name?: string;
  userId?: string;
};

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

function isNotFoundError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const response = (error as { response?: { status?: number } }).response;
  return response?.status === 404;
}

/**
 * Create a Vertex AI Agent Engine session (#43).
 * Conversation state lives in Agent Engine Sessions — not Cloud SQL.
 */
export async function createAgentSession(userId: string): Promise<string> {
  const config = requireAgentEngineConfig();
  const client = await getAuthorizedClient();
  const url = `${vertexApiBase(config.location)}/${config.orchestratorResourceName}/sessions`;

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

/** Fetch a Vertex session for ownership checks (#44). */
export async function getAgentSession(sessionId: string): Promise<VertexSession> {
  const config = requireAgentEngineConfig();
  const client = await getAuthorizedClient();
  const url = `${vertexApiBase(config.location)}/${config.orchestratorResourceName}/sessions/${sessionId}`;

  try {
    const response = await client.request<VertexSession>({
      url,
      method: "GET",
    });
    return response.data;
  } catch (error) {
    if (isNotFoundError(error)) {
      throw new AgentSessionNotFoundError();
    }
    throw error;
  }
}

/** Ensure the Firebase uid owns the Vertex session (#44). */
export async function assertAgentSessionOwnership(
  userId: string,
  sessionId: string,
): Promise<void> {
  const session = await getAgentSession(sessionId);
  if (session.userId !== userId) {
    throw new AgentSessionForbiddenError();
  }
}
