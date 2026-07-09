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
  inferPersonaTasteEvidence,
  inferPersonaKey,
  resolveAgentReplyText,
  type StreamEvent,
} from "./stream-parser";
import { buildRecommendationContextMessage } from "./recommendation-context-message";
import { buildCollectionContextMessage } from "./collection-context-message";
import type { AgentEvent, AgentMessage, RecommendationContext } from "./types";
import type { CollectionConsultContext } from "./collection-context-message";
import { assertAgentSessionOwnership } from "./session-client";
import { appendAgentConsultationTurn } from "@/lib/dal/agent-consultations";
import { fetchPlaceDetails } from "@/lib/places/google-places-client";
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
  skipConsultationPersist?: boolean;
  skipAgentEvents?: boolean;
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
): Promise<string> {
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

  const text = resolveAgentReplyText(textParts.join(""), personaTextParts.join(""));
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

  let text: string;
  try {
    text = await consumeStreamQueryResponse(response, (streamEvent) => {
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

  const personaKey = inferPersonaKey(text, thinkingMessages);
  const personaTasteHint = inferPersonaTasteEvidence(text, thinkingMessages);
  const recommendation = isAgentAssertionTurn(text)
    ? await buildAgentRecommendation(
        input.userId,
        text,
        personaTasteHint,
        personaKey,
      )
    : null;

  const agentMessage: AgentMessage = {
    role: "agent",
    text,
    ...(thinkingMessages.length > 0 ? { thinking: thinkingMessages } : {}),
    ...(recommendation ? { recommendation } : {}),
  };

  if (!input.skipConsultationPersist) {
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
  }

  return agentMessage;
}

/** Seed Vertex session state with home recommendation context (#204). Best-effort. */
export async function seedAgentRecommendationContext(input: {
  userId: string;
  sessionId: string;
  context: RecommendationContext;
}): Promise<void> {
  try {
    let context = input.context;
    if (!context.placeName?.trim()) {
      const place = await fetchPlaceDetails(context.placeId);
      if (place?.name?.trim()) {
        context = { ...context, placeName: place.name.trim() };
      }
    }
    await sendAgentMessage({
      userId: input.userId,
      sessionId: input.sessionId,
      text: buildRecommendationContextMessage(context),
      skipConsultationPersist: true,
      skipAgentEvents: true,
    });
  } catch {
    // Context seeding must not block chat start.
  }
}

/** Seed Vertex session state with collection consult context (#239). Best-effort. */
export async function seedAgentCollectionContext(input: {
  userId: string;
  sessionId: string;
  context: CollectionConsultContext;
}): Promise<void> {
  try {
    await sendAgentMessage({
      userId: input.userId,
      sessionId: input.sessionId,
      text: buildCollectionContextMessage(input.context),
      skipConsultationPersist: true,
      skipAgentEvents: true,
    });
  } catch {
    // Context seeding must not block chat start.
  }
}
