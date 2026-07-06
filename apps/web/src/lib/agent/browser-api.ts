"use client";

import {
  apiJson,
  parseApiJson,
} from "@/lib/api/browser-client";
import {
  agentMessageSchema,
  createAgentSessionResponseSchema,
  placeDtoSchema,
} from "@/lib/api/schemas/agent";
import { readApiErrorResponse } from "@/lib/auth/api-error";
import { authFetch } from "@/lib/auth/auth-fetch";

import { parseSseBuffer } from "./chat-helpers";
import type {
  AgentEvent,
  AgentMessage,
  AgentMessageRequest,
  PlaceDTO,
} from "./types";

/** Create a Vertex agent session (#43). */
export async function createAgentSession(): Promise<string> {
  const data = await apiJson(
    "/api/v1/agent/sessions",
    createAgentSessionResponseSchema,
    "エージェントセッションを作成できませんでした",
    { init: { method: "POST" } },
  );
  return data.sessionId;
}

/** Send a user turn (#44). */
export async function sendAgentMessage(
  sessionId: string,
  body: AgentMessageRequest,
): Promise<AgentMessage> {
  return apiJson(
    `/api/v1/agent/sessions/${sessionId}/messages`,
    agentMessageSchema,
    "メッセージを送信できませんでした",
    {
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    },
  );
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
    throw await readApiErrorResponse(response, "イベントストリームを開けませんでした");
  }
  if (!response.body) {
    throw new Error("イベントストリームの応答が空です");
  }

  readAgentEventStream(response.body, onEvent, signal).catch(() => {});
}

/** Fetch place display fields at render time (guardrail 7). */
export async function fetchPlace(placeId: string): Promise<PlaceDTO | null> {
  const response = await authFetch(`/api/v1/places/${placeId}`);
  if (!response.ok) {
    return null;
  }
  return parseApiJson(response, placeDtoSchema, "店舗情報を読み込めませんでした");
}

/** Save a spot to the viewer's collection (#40). */
export async function recollectSpot(
  spotId: string,
  targetCollectionId: string,
): Promise<boolean> {
  const response = await authFetch(`/api/v1/spots/${spotId}/recollect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetCollectionId }),
  });
  return response.ok;
}
