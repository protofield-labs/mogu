import "server-only";

import {
  AgentSessionError,
  AgentSessionNotFoundError,
} from "./errors";
import {
  buildAgentUserMessage,
  parseAgentStreamResponse,
} from "./stream-parser";
import type { AgentMessage } from "./types";
import { assertAgentSessionOwnership } from "./session-client";
import {
  getAccessToken,
  requireAgentEngineConfig,
  vertexApiBase,
} from "./vertex-client";

type SendAgentMessageInput = {
  userId: string;
  sessionId: string;
  text: string;
  chips?: string[];
};

/**
 * Send a user turn to the orchestrator via Vertex :streamQuery (#44).
 * Aggregates NDJSON chunks into a single AgentMessage for the REST API.
 */
export async function sendAgentMessage(
  input: SendAgentMessageInput,
): Promise<AgentMessage> {
  await assertAgentSessionOwnership(input.userId, input.sessionId);

  const config = requireAgentEngineConfig();
  const token = await getAccessToken();
  const url = `${vertexApiBase(config.location)}/${config.orchestratorResourceName}:streamQuery`;
  const message = buildAgentUserMessage(input.text, input.chips);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      class_method: "async_stream_query",
      input: {
        user_id: input.userId,
        session_id: input.sessionId,
        message,
      },
    }),
  });

  const raw = await response.text();
  if (!response.ok) {
    if (response.status === 404) {
      throw new AgentSessionNotFoundError();
    }
    throw new AgentSessionError(
      raw.trim() || `Vertex AI streamQuery failed (${response.status})`,
    );
  }

  return parseAgentStreamResponse(raw);
}
