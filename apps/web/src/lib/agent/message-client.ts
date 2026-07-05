import "server-only";

import { publishAgentEvent } from "./event-bus";
import {
  AgentSessionError,
  AgentSessionNotFoundError,
} from "./errors";
import {
  applyStreamEvent,
  buildAgentUserMessage,
  createDoneEvent,
  drainJsonObjects,
  extractThinkingEvent,
  type StreamEvent,
} from "./stream-parser";
import type { AgentMessage, AgentEvent } from "./types";
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

async function consumeStreamQueryResponse(
  response: Response,
  onEvent: (event: StreamEvent) => void,
): Promise<string> {
  if (!response.body) {
    throw new AgentSessionError("Vertex AI streamQuery returned empty body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const textParts: string[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const drained = drainJsonObjects(buffer);
    buffer = drained.remainder;

    for (const event of drained.events) {
      onEvent(event);
      applyStreamEvent(event, textParts);
    }
  }

  if (buffer.trim()) {
    const trailing = drainJsonObjects(buffer);
    for (const event of trailing.events) {
      onEvent(event);
      applyStreamEvent(event, textParts);
    }
  }

  const text = textParts.join("").trim();
  if (!text) {
    throw new AgentSessionError("Vertex AI agent returned empty response");
  }

  return text;
}

/**
 * Send a user turn to the orchestrator via Vertex :streamQuery (#44).
 * Publishes thinking/done AgentEvents for SSE subscribers (#45).
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

  if (!response.ok) {
    const raw = await response.text();
    if (response.status === 404) {
      throw new AgentSessionNotFoundError();
    }
    throw new AgentSessionError(
      raw.trim() || `Vertex AI streamQuery failed (${response.status})`,
    );
  }

  const thinkingMessages: string[] = [];
  const seenThinking = new Set<string>();

  const publishThinking = (event: AgentEvent) => {
    if (seenThinking.has(event.message)) {
      return;
    }
    seenThinking.add(event.message);
    thinkingMessages.push(event.message);
    publishAgentEvent(input.userId, input.sessionId, event);
  };

  const text = await consumeStreamQueryResponse(response, (streamEvent) => {
    const thinking = extractThinkingEvent(streamEvent);
    if (thinking) {
      publishThinking(thinking);
    }
  });

  publishAgentEvent(input.userId, input.sessionId, createDoneEvent());

  return {
    role: "agent",
    text,
    ...(thinkingMessages.length > 0 ? { thinking: thinkingMessages } : {}),
  };
}
