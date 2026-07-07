import type { ChatEntry } from "@/lib/agent/chat-helpers";
import { isRecommendation } from "@/lib/agent/chat-helpers";
import { isValidSessionId } from "@/lib/agent/session-id";

export const AGENT_CHAT_SESSION_KEY = "mogu:agent-chat-session";
export const AGENT_CHAT_SESSION_TTL_MS = 30 * 60 * 1000;

export type StoredAgentChatSession = {
  userId: string;
  sessionId: string;
  entries: ChatEntry[];
  savedAt: string;
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
    return parsed;
  } catch {
    return null;
  }
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
): void {
  if (typeof window === "undefined" || !userId || entries.length === 0) {
    return;
  }
  const payload: StoredAgentChatSession = {
    userId,
    sessionId,
    entries,
    savedAt: new Date().toISOString(),
  };
  window.sessionStorage.setItem(AGENT_CHAT_SESSION_KEY, JSON.stringify(payload));
}

export function clearAgentChatSession(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.removeItem(AGENT_CHAT_SESSION_KEY);
}
