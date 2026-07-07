import type { ChatEntry } from "@/lib/agent/chat-helpers";
import { isRecommendation } from "@/lib/agent/chat-helpers";
import { isValidSessionId } from "@/lib/agent/session-id";
import { getFirebaseAuth } from "@/lib/auth/firebase-client";

export const AGENT_CHAT_SESSION_KEY = "mogu:agent-chat-session";
export const AGENT_CHAT_SESSION_TTL_MS = 30 * 60 * 1000;

let writeEpoch = 0;

export function getAgentChatWriteEpoch(): number {
  return writeEpoch;
}

function bumpAgentChatWriteEpoch(): void {
  writeEpoch += 1;
}

export type StoredAgentChatSession = {
  userId: string;
  sessionId: string;
  entries: ChatEntry[];
  savedAt: string;
  /** Set while waiting for the agent reply to a user turn (#152). */
  pendingUserEntryId?: string;
};

export type SaveAgentChatSessionOptions = {
  pendingUserEntryId?: string | null;
  /** Reject writes from stale in-flight sends after clear/new consultation (#152). */
  writeEpoch?: number;
};

function isChatEntry(value: unknown): value is ChatEntry {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const entry = value as ChatEntry;
  if (entry.kind === "user") {
    return typeof entry.id === "string" && typeof entry.text === "string";
  }
  if (entry.kind === "agent") {
    return (
      typeof entry.id === "string" &&
      typeof entry.text === "string" &&
      (entry.recommendation === undefined || isRecommendation(entry.recommendation))
    );
  }
  return false;
}

export function isStoredAgentChatSessionFresh(
  stored: StoredAgentChatSession,
  now: number = Date.now(),
): boolean {
  const savedAt = new Date(stored.savedAt).getTime();
  if (Number.isNaN(savedAt)) {
    return false;
  }
  return now - savedAt <= AGENT_CHAT_SESSION_TTL_MS;
}

export function isAgentReplyPending(stored: StoredAgentChatSession): boolean {
  const pendingId = stored.pendingUserEntryId;
  if (!pendingId) {
    return false;
  }
  const pendingIndex = stored.entries.findIndex((entry) => entry.id === pendingId);
  if (pendingIndex === -1) {
    return false;
  }
  return !stored.entries
    .slice(pendingIndex + 1)
    .some((entry) => entry.kind === "agent" && entry.id !== "welcome");
}

/** Drop stale pending markers or orphaned in-flight user bubbles. */
export function reconcileStoredAgentChatSession(
  stored: StoredAgentChatSession,
): StoredAgentChatSession {
  if (!stored.pendingUserEntryId) {
    return stored;
  }
  if (!isAgentReplyPending(stored)) {
    const { pendingUserEntryId: _removed, ...rest } = stored;
    return rest;
  }
  return stored;
}

export function parseStoredAgentChatSession(
  raw: string,
): StoredAgentChatSession | null {
  try {
    const parsed = JSON.parse(raw) as StoredAgentChatSession;
    if (
      !parsed ||
      typeof parsed.userId !== "string" ||
      parsed.userId.length === 0 ||
      typeof parsed.sessionId !== "string" ||
      !isValidSessionId(parsed.sessionId) ||
      typeof parsed.savedAt !== "string" ||
      !Array.isArray(parsed.entries) ||
      parsed.entries.length === 0 ||
      !parsed.entries.every(isChatEntry)
    ) {
      return null;
    }
    if (
      parsed.pendingUserEntryId !== undefined &&
      typeof parsed.pendingUserEntryId !== "string"
    ) {
      return null;
    }
    return reconcileStoredAgentChatSession(parsed);
  } catch {
    return null;
  }
}

export function canWriteAgentChatSession(
  userId: string,
  sessionId: string,
): boolean {
  if (typeof window === "undefined" || !userId) {
    return false;
  }
  const currentUid = getFirebaseAuth().currentUser?.uid;
  if (!currentUid || currentUid !== userId) {
    return false;
  }
  const raw = window.sessionStorage.getItem(AGENT_CHAT_SESSION_KEY);
  if (!raw) {
    return true;
  }
  const parsed = parseStoredAgentChatSession(raw);
  if (!parsed) {
    return true;
  }
  return parsed.userId === userId && parsed.sessionId === sessionId;
}

export function loadAgentChatSession(userId: string): StoredAgentChatSession | null {
  if (typeof window === "undefined" || !userId) {
    return null;
  }
  const raw = window.sessionStorage.getItem(AGENT_CHAT_SESSION_KEY);
  if (!raw) {
    return null;
  }
  const parsed = parseStoredAgentChatSession(raw);
  if (
    !parsed ||
    parsed.userId !== userId ||
    !isStoredAgentChatSessionFresh(parsed)
  ) {
    window.sessionStorage.removeItem(AGENT_CHAT_SESSION_KEY);
    return null;
  }
  return parsed;
}

export function saveAgentChatSession(
  userId: string,
  sessionId: string,
  entries: ChatEntry[],
  options?: SaveAgentChatSessionOptions,
): void {
  if (typeof window === "undefined" || !userId || entries.length === 0) {
    return;
  }
  if (
    options?.writeEpoch !== undefined &&
    options.writeEpoch !== writeEpoch
  ) {
    return;
  }
  if (!canWriteAgentChatSession(userId, sessionId)) {
    return;
  }
  const payload: StoredAgentChatSession = {
    userId,
    sessionId,
    entries,
    savedAt: new Date().toISOString(),
  };
  if (options?.pendingUserEntryId) {
    payload.pendingUserEntryId = options.pendingUserEntryId;
  }
  window.sessionStorage.setItem(AGENT_CHAT_SESSION_KEY, JSON.stringify(payload));
}

export function clearAgentChatSession(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.removeItem(AGENT_CHAT_SESSION_KEY);
  bumpAgentChatWriteEpoch();
}

export function clearStalePendingAgentReply(
  userId: string,
  sessionId: string,
  entries: ChatEntry[],
): void {
  saveAgentChatSession(userId, sessionId, entries);
}
