import "server-only";

import { publishAgentEvent } from "./event-bus";
import { AgentSessionError, AgentSessionNotFoundError } from "./errors";
import {
  applyStreamEvent,
  createDoneEvent,
  drainJsonObjects,
  extractThinkingEvent,
  resolveAgentReplyText,
  type StreamEvent,
} from "./stream-parser";
import type { AgentEvent } from "./types";
import { logger } from "@/lib/logger";
import {
  getAccessToken,
  requireAgentEngineConfig,
  vertexApiBase,
} from "./vertex-client";

export type StreamQueryResult = {
  /** User-facing reply after orchestrator/persona resolution. */
  text: string;
  /** Raw orchestrator text — may hold markers the resolver dropped (#313). */
  orchestratorText: string;
  /** Raw persona text — may hold markers the orchestrator rewrote away (#313). */
  personaText: string;
};

export type ExecuteAgentStreamQueryInput = {
  userId: string;
  sessionId: string;
  message: string;
  skipAgentEvents?: boolean;
};

export type ExecuteAgentStreamQueryResult = {
  streamResult: StreamQueryResult;
  thinkingMessages: string[];
};

function drainStreamBuffer(
  buffer: string,
  onEvent: (event: StreamEvent) => void,
  textParts: string[],
  personaTextParts: string[],
): string {
  const drained = drainJsonObjects(buffer);
  for (const event of drained.events) {
    onEvent(event);
    applyStreamEvent(event, textParts, personaTextParts);
  }
  return drained.remainder;
}

async function consumeStreamQueryResponse(
  response: Response,
  onEvent: (event: StreamEvent) => void,
): Promise<StreamQueryResult> {
  if (!response.body) {
    throw new AgentSessionError("Vertex AI streamQuery returned empty body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const textParts: string[] = [];
  const personaTextParts: string[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer = drainStreamBuffer(
      buffer + decoder.decode(value, { stream: true }),
      onEvent,
      textParts,
      personaTextParts,
    );
  }

  buffer = drainStreamBuffer(
    buffer + decoder.decode(),
    onEvent,
    textParts,
    personaTextParts,
  );

  const orchestratorText = textParts.join("");
  const personaText = personaTextParts.join("");
  const text = resolveAgentReplyText(orchestratorText, personaText);
  if (!text) {
    throw new AgentSessionError("Vertex AI agent returned empty response");
  }

  return { text, orchestratorText, personaText };
}

/**
 * Call Vertex :streamQuery and consume the SSE body (#44 / #335).
 * Publishes thinking/done AgentEvents for SSE subscribers (#45).
 */
export async function executeAgentStreamQuery(
  input: ExecuteAgentStreamQueryInput,
): Promise<ExecuteAgentStreamQueryResult> {
  const config = requireAgentEngineConfig();
  const token = await getAccessToken();
  const url = `${vertexApiBase(config.location)}/${config.orchestratorResourceName}:streamQuery`;

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
        message: input.message,
      },
    }),
  });

  if (!response.ok) {
    const raw = await response.text();
    if (response.status === 404) {
      throw new AgentSessionNotFoundError();
    }
    logger.error("Vertex AI streamQuery failed", {
      status: response.status,
      sessionId: input.sessionId,
      bodyPreview: raw.trim().slice(0, 500) || null,
    });
    throw new AgentSessionError(
      "Agent Engine request failed. Please try again shortly.",
    );
  }

  const thinkingMessages: string[] = [];
  const seenThinking = new Set<string>();
  let publishChain = Promise.resolve();
  const publishEvents = !input.skipAgentEvents;

  const publishEventBestEffort = async (event: AgentEvent) => {
    if (!publishEvents) {
      return;
    }
    try {
      await publishAgentEvent(input.userId, input.sessionId, event);
    } catch {
      // SSE persistence is best-effort; the Vertex turn already succeeded.
    }
  };

  const publishThinking = (event: AgentEvent) => {
    if (!publishEvents) {
      return;
    }
    if (seenThinking.has(event.message)) {
      return;
    }
    seenThinking.add(event.message);
    thinkingMessages.push(event.message);
    publishChain = publishChain.then(() => publishEventBestEffort(event));
  };

  let streamResult: StreamQueryResult;
  try {
    streamResult = await consumeStreamQueryResponse(response, (streamEvent) => {
      const thinking = extractThinkingEvent(streamEvent);
      if (thinking) {
        publishThinking(thinking);
      }
    });
  } finally {
    if (publishEvents) {
      await publishChain;
      await publishEventBestEffort(createDoneEvent());
    }
  }

  return { streamResult, thinkingMessages };
}
