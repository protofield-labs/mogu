import "server-only";

import { isAgentAssertionTurn } from "./assertion-turn";
import { buildAgentRecommendation } from "./build-recommendation";
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
import { appendAgentConsultationTurn } from "@/lib/dal/agent-consultations";
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

function drainStreamBuffer(
  buffer: string,
  onEvent: (event: StreamEvent) => void,
  textParts: string[],
): string {
  const drained = drainJsonObjects(buffer);
  for (const event of drained.events) {
    onEvent(event);
    applyStreamEvent(event, textParts);
  }
  return drained.remainder;
}

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

    buffer = drainStreamBuffer(
      buffer + decoder.decode(value, { stream: true }),
      onEvent,
      textParts,
    );
  }

  buffer = drainStreamBuffer(buffer + decoder.decode(), onEvent, textParts);

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
  let publishChain = Promise.resolve();

  const publishEventBestEffort = async (event: AgentEvent) => {
    try {
      await publishAgentEvent(input.userId, input.sessionId, event);
    } catch {
      // SSE persistence is best-effort; the Vertex turn already succeeded.
    }
  };

  const publishThinking = (event: AgentEvent) => {
    if (seenThinking.has(event.message)) {
      return;
    }
    seenThinking.add(event.message);
    thinkingMessages.push(event.message);
    publishChain = publishChain.then(() => publishEventBestEffort(event));
  };

  let text: string;
  try {
    text = await consumeStreamQueryResponse(response, (streamEvent) => {
      const thinking = extractThinkingEvent(streamEvent);
      if (thinking) {
        publishThinking(thinking);
      }
    });
  } finally {
    await publishChain;
    await publishEventBestEffort(createDoneEvent());
  }

  const recommendation = isAgentAssertionTurn(text)
    ? await buildAgentRecommendation(input.userId, text)
    : null;

  const agentMessage: AgentMessage = {
    role: "agent",
    text,
    ...(thinkingMessages.length > 0 ? { thinking: thinkingMessages } : {}),
    ...(recommendation ? { recommendation } : {}),
  };

  try {
    await appendAgentConsultationTurn(
      input.userId,
      input.sessionId,
      input.text,
      input.chips,
      agentMessage,
    );
  } catch {
    // History persistence is best-effort; the Vertex turn already succeeded.
  }

  return agentMessage;
}
