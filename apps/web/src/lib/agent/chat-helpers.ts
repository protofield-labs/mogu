import type { AgentEvent, Recommendation, Spot } from "./types";
import type { PersonaIntroKey } from "@/lib/agent/persona-intro";

/** Agent opening copy (features 2-1, wireframe search-2b). */
export const AGENT_OPENING_MESSAGE =
  "今夜はどんな気分？\nエリアや人数だけでもOK。";

const AGENT_ENGINE_NOT_CONFIGURED = "Agent Engine is not configured";

/** Map API / network errors to user-facing Japanese (#83). */
export function formatAgentUserError(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) {
    return fallback;
  }
  const message = error.message;
  if (message.includes(AGENT_ENGINE_NOT_CONFIGURED)) {
    return "エージェントが準備中です。しばらくしてから再度お試しください";
  }
  if (message === "Failed to fetch" || message.includes("NetworkError")) {
    return "通信に失敗しました。接続を確認してください";
  }
  if (
    message.startsWith("Failed to create agent session") ||
    message.startsWith("Failed to send message") ||
    message.startsWith("Failed to open event stream")
  ) {
    return fallback;
  }
  return message;
}

/** Client-side signal that a restored Vertex session is no longer usable. */
export function isAgentSessionUnavailableError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message;
  return (
    message.includes("イベントストリーム") ||
    message.includes("メッセージを送信") ||
    message === "対象が見つかりません" ||
    message === "この操作は許可されていません"
  );
}

export type ChatEntry =
  | { id: string; kind: "user"; text: string; chips?: string[] }
  | {
      id: string;
      kind: "agent";
      text: string;
      recommendation?: Recommendation;
      candidateSpots?: Spot[];
      quickReplies?: string[];
      personaKey?: PersonaIntroKey;
    };

export function createWelcomeEntry(): ChatEntry {
  return {
    id: "welcome",
    kind: "agent",
    text: AGENT_OPENING_MESSAGE,
  };
}

export function createUserEntry(text: string, chips?: string[]): ChatEntry {
  return {
    id: `user-${Date.now()}`,
    kind: "user",
    text,
    ...(chips?.length ? { chips } : {}),
  };
}

export function createAgentEntry(message: {
  text: string;
  recommendation?: Recommendation;
  candidateSpots?: Spot[];
  quickReplies?: string[];
  personaKey?: PersonaIntroKey;
}): ChatEntry {
  return {
    id: `agent-${Date.now()}`,
    kind: "agent",
    text: message.text,
    ...(message.recommendation ? { recommendation: message.recommendation } : {}),
    ...(message.candidateSpots?.length
      ? { candidateSpots: message.candidateSpots }
      : {}),
    ...(message.quickReplies?.length
      ? { quickReplies: message.quickReplies }
      : {}),
    ...(message.personaKey ? { personaKey: message.personaKey } : {}),
  };
}

export function formatUserBubbleText(entry: Extract<ChatEntry, { kind: "user" }>): string {
  if (!entry.chips?.length) {
    return entry.text;
  }
  return `${entry.text}\n[${entry.chips.join(" / ")}]`;
}

export function isRecommendation(value: unknown): value is Recommendation {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const rec = value as Recommendation;
  return (
    typeof rec.assertion === "string" &&
    typeof rec.evidence === "string" &&
    typeof rec.spot === "object" &&
    rec.spot !== null &&
    Array.isArray(rec.alternatives)
  );
}

/** Parse SSE frames from a growing buffer (#45 client, #67 id replay). */
export function parseSseBuffer(buffer: string): {
  events: AgentEvent[];
  remainder: string;
  lastEventId?: string;
  connected: boolean;
} {
  const events: AgentEvent[] = [];
  const frames = buffer.split("\n\n");
  const remainder = frames.pop() ?? "";
  let lastEventId: string | undefined;
  let connected = false;

  for (const frame of frames) {
    let frameEventId: string | undefined;
    let frameData: string | undefined;

    for (const line of frame.split("\n")) {
      if (line.startsWith(": connected")) {
        connected = true;
        continue;
      }
      if (line.startsWith("id: ")) {
        frameEventId = line.slice(4).trim();
        continue;
      }
      if (line.startsWith("data: ")) {
        frameData = line.slice(6);
      }
    }

    if (frameData !== undefined) {
      try {
        events.push(JSON.parse(frameData) as AgentEvent);
        if (frameEventId) {
          lastEventId = frameEventId;
        }
      } catch {
        // Skip malformed frames.
      }
    }
  }

  return { events, remainder, lastEventId, connected };
}
