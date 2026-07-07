"use client";

import {
  agentConsultationDetailSchema,
  agentConsultationSummaryListSchema,
} from "@/lib/api/schemas/agent-consultations";
import {
  apiJson,
  apiVoid,
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
import type { ChatEntry } from "./chat-helpers";

export type AgentConsultationSummary = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type AgentConsultationDetail = AgentConsultationSummary & {
  vertexSessionId: string;
  entries: ChatEntry[];
  resumable: boolean;
};

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

/** List recent agent consultations (#153 Phase A). */
export async function listAgentConsultations(): Promise<
  AgentConsultationSummary[]
> {
  return apiJson(
    "/api/v1/agent/consultations",
    agentConsultationSummaryListSchema,
    "相談履歴を読み込めませんでした",
  );
}

/** Fetch one consultation with resumable flag (#153 Phase B). */
export async function fetchAgentConsultation(
  id: string,
): Promise<AgentConsultationDetail> {
  return apiJson(
    `/api/v1/agent/consultations/${id}`,
    agentConsultationDetailSchema,
    "相談履歴を読み込めませんでした",
  );
}

/** Persist welcome / pending recommendation entries after session start. */
export async function syncAgentConsultationEntries(
  sessionId: string,
  entries: ChatEntry[],
): Promise<void> {
  await apiVoid("/api/v1/agent/consultations/sync", "相談履歴を保存できませんでした", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, entries }),
  });
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
  onProgress?: (state: { lastEventId?: string; connected: boolean }) => void,
): Promise<{ lastEventId?: string; connected: boolean }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let lastEventId: string | undefined;
  let connected = false;

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
      if (parsed.lastEventId) {
        lastEventId = parsed.lastEventId;
      }
      if (parsed.connected) {
        connected = true;
      }
      onProgress?.({ lastEventId, connected });
      for (const event of parsed.events) {
        onEvent(event);
      }
    }

    const trailing = parseSseBuffer(`${buffer}\n\n`);
    if (trailing.lastEventId) {
      lastEventId = trailing.lastEventId;
    }
    if (trailing.connected) {
      connected = true;
    }
    onProgress?.({ lastEventId, connected });
    for (const event of trailing.events) {
      onEvent(event);
    }
  } finally {
    reader.releaseLock();
  }

  return { lastEventId, connected };
}

export type ConnectAgentEventsResult = {
  lastEventId?: string;
};

/**
 * Open SSE, replay missed events via Last-Event-ID, and read until disconnect (#45, #67).
 */
export async function connectAgentEvents(
  sessionId: string,
  onEvent: (event: AgentEvent) => void,
  signal: AbortSignal,
  lastEventId?: string,
  onProgress?: (state: { lastEventId?: string; connected: boolean }) => void,
): Promise<ConnectAgentEventsResult> {
  const headers: Record<string, string> = {};
  if (lastEventId) {
    headers["Last-Event-ID"] = lastEventId;
  }

  const response = await authFetch(
    `/api/v1/agent/sessions/${sessionId}/events`,
    { signal, headers },
  );
  if (!response.ok) {
    throw await readApiErrorResponse(response, "イベントストリームを開けませんでした");
  }
  if (!response.body) {
    throw new Error("イベントストリームの応答が空です");
  }

  const result = await readAgentEventStream(
    response.body,
    onEvent,
    signal,
    onProgress,
  );
  return { lastEventId: result.lastEventId ?? lastEventId };
}

/** Fetch place display fields at render time (guardrail 7). */
export async function fetchPlace(placeId: string): Promise<PlaceDTO | null> {
  const response = await authFetch(`/api/v1/places/${placeId}`);
  if (!response.ok) {
    return null;
  }
  return parseApiJson(response, placeDtoSchema, "店舗情報を読み込めませんでした");
}
