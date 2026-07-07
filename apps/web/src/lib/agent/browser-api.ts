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
import { spotSchema } from "@/lib/api/schemas/spot";
import type { SpotDto } from "@/lib/spot/types";
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
): Promise<SpotDto | null> {
  const response = await authFetch(`/api/v1/spots/${spotId}/recollect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetCollectionId }),
  });
  if (!response.ok) {
    return null;
  }
  return parseApiJson(response, spotSchema, "保存に失敗しました");
}
