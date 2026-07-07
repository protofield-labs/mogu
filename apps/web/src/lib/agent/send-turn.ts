"use client";

import { connectAgentEvents, sendAgentMessage } from "@/lib/agent/browser-api";
import {
  createAgentEntry,
  type ChatEntry,
} from "@/lib/agent/chat-helpers";
import { saveAgentChatSession, getAgentChatWriteEpoch } from "@/lib/agent/session-storage";

export type SendTurnSuccess = {
  ok: true;
  entries: ChatEntry[];
  userEntryId: string;
};

export type SendTurnFailure = {
  ok: false;
  entries: ChatEntry[];
  userEntryId: string;
  error: unknown;
};

export type SendTurnResult = SendTurnSuccess | SendTurnFailure;

type InflightRecord = {
  promise: Promise<SendTurnResult>;
  abortSse: () => void;
};

const inflightBySession = new Map<string, InflightRecord>();

function inflightKey(userId: string, sessionId: string): string {
  return `${userId}:${sessionId}`;
}

export function getInflightAgentTurn(
  userId: string,
  sessionId: string,
): Promise<SendTurnResult> | null {
  return inflightBySession.get(inflightKey(userId, sessionId))?.promise ?? null;
}

export function abortInflightAgentTurnSse(userId: string, sessionId: string): void {
  inflightBySession.get(inflightKey(userId, sessionId))?.abortSse();
}

async function executeSendTurn(params: {
  userId: string;
  sessionId: string;
  text: string;
  chips?: string[];
  entriesBefore: ChatEntry[];
  userEntry: Extract<ChatEntry, { kind: "user" }>;
  onThinking?: (message: string) => void;
  sseSignal: AbortSignal;
}): Promise<SendTurnResult> {
  const {
    userId,
    sessionId,
    text,
    chips,
    entriesBefore,
    userEntry,
    onThinking,
    sseSignal,
  } = params;
  const entriesWithUser: ChatEntry[] = [...entriesBefore, userEntry];
  const writeEpoch = getAgentChatWriteEpoch();

  saveAgentChatSession(userId, sessionId, entriesWithUser, {
    pendingUserEntryId: userEntry.id,
    writeEpoch,
  });

  const seenThinking = new Set<string>();

  try {
    await connectAgentEvents(
      sessionId,
      (event) => {
        if (event.type !== "thinking" || seenThinking.has(event.message)) {
          return;
        }
        seenThinking.add(event.message);
        onThinking?.(event.message);
      },
      sseSignal,
    );

    const agentMessage = await sendAgentMessage(sessionId, { text, chips });
    const entries: ChatEntry[] = [
      ...entriesWithUser,
      createAgentEntry({
        text: agentMessage.text,
        recommendation: agentMessage.recommendation,
        quickReplies: agentMessage.quickReplies,
      }),
    ];
    saveAgentChatSession(userId, sessionId, entries, { writeEpoch });
    return { ok: true, entries, userEntryId: userEntry.id };
  } catch (error) {
    saveAgentChatSession(userId, sessionId, entriesBefore, { writeEpoch });
    return {
      ok: false,
      entries: entriesBefore,
      userEntryId: userEntry.id,
      error,
    };
  }
}

/** Send one user turn; survives AgentChat unmount until the server responds. */
export function sendAgentTurn(params: {
  userId: string;
  sessionId: string;
  text: string;
  chips?: string[];
  entriesBefore: ChatEntry[];
  userEntry: Extract<ChatEntry, { kind: "user" }>;
  onThinking?: (message: string) => void;
}): Promise<SendTurnResult> {
  const key = inflightKey(params.userId, params.sessionId);
  const existing = inflightBySession.get(key);
  if (existing) {
    return existing.promise;
  }

  const abortSse = new AbortController();
  const promise = executeSendTurn({
    ...params,
    sseSignal: abortSse.signal,
  }).finally(() => {
    inflightBySession.delete(key);
  });

  inflightBySession.set(key, {
    promise,
    abortSse: () => abortSse.abort(),
  });

  return promise;
}
