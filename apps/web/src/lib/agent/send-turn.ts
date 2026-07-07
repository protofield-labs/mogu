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

const SSE_READY_TIMEOUT_MS = 15_000;

function waitForSseReady(
  getReady: () => boolean,
  hasFailed: () => boolean,
  signal: AbortSignal,
): Promise<void> {
  if (getReady() || hasFailed()) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const deadline = Date.now() + SSE_READY_TIMEOUT_MS;
    const timer = setInterval(() => {
      if (signal.aborted) {
        clearInterval(timer);
        reject(new DOMException("Aborted", "AbortError"));
        return;
      }
      if (hasFailed()) {
        clearInterval(timer);
        resolve();
        return;
      }
      if (getReady()) {
        clearInterval(timer);
        resolve();
        return;
      }
      if (Date.now() > deadline) {
        clearInterval(timer);
        reject(new Error("イベントストリームを開けませんでした"));
      }
    }, 10);
  });
}

async function executeSendTurn(params: {
  userId: string;
  sessionId: string;
  text: string;
  chips?: string[];
  entriesBefore: ChatEntry[];
  userEntry: Extract<ChatEntry, { kind: "user" }>;
  onThinking?: (message: string) => void;
  sseAbort: AbortController;
}): Promise<SendTurnResult> {
  const {
    userId,
    sessionId,
    text,
    chips,
    entriesBefore,
    userEntry,
    onThinking,
    sseAbort,
  } = params;
  const sseSignal = sseAbort.signal;
  const entriesWithUser: ChatEntry[] = [...entriesBefore, userEntry];
  const writeEpoch = getAgentChatWriteEpoch();

  saveAgentChatSession(userId, sessionId, entriesWithUser, {
    pendingUserEntryId: userEntry.id,
    writeEpoch,
  });

  const seenThinking = new Set<string>();
  let lastEventId: string | undefined;
  let sseReady = false;
  let turnComplete = false;
  let fatalSseError: unknown;

  const handleEvent = (event: { type: string; message: string }) => {
    if (event.type !== "thinking" || seenThinking.has(event.message)) {
      return;
    }
    seenThinking.add(event.message);
    onThinking?.(event.message);
  };

  const sseLoop = (async () => {
    while (!turnComplete && !sseSignal.aborted) {
      try {
        const result = await connectAgentEvents(
          sessionId,
          handleEvent,
          sseSignal,
          lastEventId,
          ({ connected, lastEventId: nextId }) => {
            if (connected) {
              sseReady = true;
            }
            if (nextId) {
              lastEventId = nextId;
            }
          },
        );
        if (result.lastEventId) {
          lastEventId = result.lastEventId;
        }
      } catch (error) {
        if (turnComplete || sseSignal.aborted) {
          return;
        }
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        if (!sseReady) {
          fatalSseError = error;
          return;
        }
      }
    }
  })();

  try {
    await waitForSseReady(
      () => sseReady,
      () => fatalSseError !== undefined,
      sseSignal,
    );
    if (fatalSseError) {
      throw fatalSseError;
    }
    if (!sseReady) {
      throw new Error("イベントストリームを開けませんでした");
    }

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
  } finally {
    turnComplete = true;
    sseAbort.abort();
    await sseLoop.catch(() => {});
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
    sseAbort: abortSse,
  }).finally(() => {
    inflightBySession.delete(key);
  });

  inflightBySession.set(key, {
    promise,
    abortSse: () => abortSse.abort(),
  });

  return promise;
}
