"use client";

import { parseApiErrorBody } from "@/lib/auth/api-error";
import { authFetch } from "@/lib/auth/auth-fetch";

import { parseSseBuffer } from "./chat-helpers";
import type {
  AgentEvent,
  AgentMessage,
  AgentMessageRequest,
  CreateAgentSessionResponse,
  PlaceDTO,
} from "./types";

async function readApiError(response: Response, fallback: string): Promise<Error> {
  const body = await parseApiErrorBody(response);
  return new Error(body?.error.message ?? fallback);
}

/** Create a Vertex agent session (#43). */
export async function createAgentSession(): Promise<string> {
  const response = await authFetch("/api/v1/agent/sessions", { method: "POST" });
  if (!response.ok) {
    throw await readApiError(response, "Failed to create agent session");
  }
  const data = (await response.json()) as CreateAgentSessionResponse;
  return data.sessionId;
}

/** Send a user turn (#44). */
export async function sendAgentMessage(
  sessionId: string,
  body: AgentMessageRequest,
): Promise<AgentMessage> {
  const response = await authFetch(
    `/api/v1/agent/sessions/${sessionId}/messages`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!response.ok) {
    throw await readApiError(response, "Failed to send message");
  }
  return (await response.json()) as AgentMessage;
}

async function readAgentEventStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: AgentEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      if (signal.aborted) {
        break;
      }
      const { done, value } = await reader.read();
      if (done) {
        buffer += decoder.decode();
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const parsed = parseSseBuffer(buffer);
      buffer = parsed.remainder;
      for (const event of parsed.events) {
        onEvent(event);
      }
    }

    const trailing = parseSseBuffer(`${buffer}\n\n`);
    for (const event of trailing.events) {
      onEvent(event);
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Open SSE and invoke onEvent while POST /messages runs.
 * Resolves once response headers arrive (#67 ordering).
 */
export async function connectAgentEvents(
  sessionId: string,
  onEvent: (event: AgentEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  const response = await authFetch(
    `/api/v1/agent/sessions/${sessionId}/events`,
    { signal },
  );
  if (!response.ok) {
    throw await readApiError(response, "Failed to open event stream");
  }
  if (!response.body) {
    throw new Error("Event stream returned empty body");
  }

  void readAgentEventStream(response.body, onEvent, signal);
}

/** Fetch place display fields at render time (guardrail 7). */
export async function fetchPlace(placeId: string): Promise<PlaceDTO | null> {
  const response = await authFetch(`/api/v1/places/${placeId}`);
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as PlaceDTO;
}

/** Save a spot to the viewer's collection (#40 API — graceful if unavailable). */
export async function recollectSpot(spotId: string): Promise<boolean> {
  const response = await authFetch(`/api/v1/spots/${spotId}/recollect`, {
    method: "POST",
  });
  return response.ok;
}
