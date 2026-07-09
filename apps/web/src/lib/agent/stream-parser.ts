import { AgentSessionError, AgentSessionNotFoundError } from "./errors";
import type { AgentEvent, AgentMessage } from "./types";

export type StreamEvent = {
  error_code?: string;
  error_message?: string;
  message?: string;
  author?: string;
  content?: {
    parts?: Array<{
      text?: string;
      function_call?: unknown;
    }>;
  };
};

const PERSONA_THINKING: Record<string, string> = {
  ken: "Kenのコレクションを参照中…",
  aoi: "Aoiのコレクションを参照中…",
};

/** Labels Gemini sometimes leaks into text parts (#251). */
const LEAKED_THINKING_LABEL =
  /^(?:thinking\s*process|chain\s*of\s*thought|internal\s*monologue)\s*:?\s*/i;

const CJK_CHAR = /[\u3040-\u30ff\u3400-\u9fff\uff66-\uff9d]/;

function isLeakedThinkingLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) {
    return true;
  }
  if (LEAKED_THINKING_LABEL.test(trimmed)) {
    return true;
  }
  // Numbered / bold outline lines are only treated as thinking when they have
  // no Japanese — real replies often use "1. 渋谷の…" style lists.
  if (/^(?:\d+[\.\)]\s+|\*\*[^*]+\*\*:?\s*)/.test(trimmed) && !CJK_CHAR.test(trimmed)) {
    return true;
  }
  return false;
}

function looksLikeUserFacingReply(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || isLeakedThinkingLine(trimmed)) {
    return false;
  }
  return CJK_CHAR.test(trimmed);
}

/**
 * Strip leaked model reasoning from agent text before display/persist (#251).
 * Drops leading thinking labels/blocks while keeping any real reply that follows
 * on the same line, the next line, or after a blank line.
 */
export function stripLeakedThinkingText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return "";
  }

  const lines = trimmed.split(/\r?\n/);
  const firstLine = lines[0] ?? "";
  if (!LEAKED_THINKING_LABEL.test(firstLine)) {
    return trimmed;
  }

  const afterLabel = firstLine.replace(LEAKED_THINKING_LABEL, "").trim();
  if (looksLikeUserFacingReply(afterLabel)) {
    // Same-line reply: "Thinking Process: 今夜はどんな気分？"
    const rest = lines.slice(1).join("\n").trim();
    return rest ? `${afterLabel}\n${rest}` : afterLabel;
  }

  // Drop consecutive English thinking / outline lines until a Japanese reply.
  let index = 1;
  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (isLeakedThinkingLine(line)) {
      index++;
      continue;
    }
    if (!CJK_CHAR.test(line)) {
      // English prose continuation of the thinking block
      index++;
      continue;
    }
    break;
  }

  return lines.slice(index).join("\n").trim();
}

function scanJsonObjects(
  raw: string,
): { events: StreamEvent[]; remainder: string } {
  const events: StreamEvent[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escape = false;
  let cursor = 0;

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];

    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === "{") {
      if (depth === 0) {
        start = i;
      }
      depth++;
      continue;
    }

    if (ch === "}" && depth > 0) {
      depth--;
      if (depth === 0 && start >= 0) {
        try {
          events.push(JSON.parse(raw.slice(start, i + 1)) as StreamEvent);
        } catch {
          // Skip malformed object; continue scanning.
        }
        cursor = i + 1;
        start = -1;
      }
    }
  }

  return {
    events,
    remainder: raw.slice(cursor),
  };
}

/** Extract complete JSON objects from a growing stream buffer (#44/#45). */
export function drainJsonObjects(buffer: string): {
  events: StreamEvent[];
  remainder: string;
} {
  return scanJsonObjects(buffer);
}

/** Extract all JSON objects from a complete response body (#44). */
export function extractJsonObjects(raw: string): StreamEvent[] {
  return scanJsonObjects(raw).events;
}

export function applyStreamEvent(event: StreamEvent, textParts: string[]): void {
  if (event.error_code) {
    throw new AgentSessionError(
      event.error_message ?? event.message ?? "Vertex AI agent query failed",
    );
  }

  if (
    textParts.length === 0 &&
    typeof event.message === "string" &&
    event.message.startsWith("404")
  ) {
    throw new AgentSessionNotFoundError();
  }

  for (const part of event.content?.parts ?? []) {
    if (part.text) {
      textParts.push(part.text);
    }
  }
}

/** Map Vertex stream event to OpenAPI AgentEvent thinking (#45). */
export function extractThinkingEvent(event: StreamEvent): AgentEvent | null {
  const personaMessage = event.author
    ? PERSONA_THINKING[event.author]
    : undefined;
  if (personaMessage) {
    return createThinkingEvent(personaMessage);
  }

  for (const part of event.content?.parts ?? []) {
    if (part.function_call) {
      return createThinkingEvent("エージェントが情報を集めています…");
    }
  }

  return null;
}

export function createThinkingEvent(message: string): AgentEvent {
  return {
    type: "thinking",
    message,
    timestamp: new Date().toISOString(),
  };
}

export function createDoneEvent(message = "思考が完了しました"): AgentEvent {
  return {
    type: "done",
    message,
    timestamp: new Date().toISOString(),
  };
}

/** Parse Reasoning Engine :streamQuery body into AgentMessage (#44). */
export function parseAgentStreamResponse(raw: string): AgentMessage {
  const textParts: string[] = [];
  const events = extractJsonObjects(raw);

  for (const event of events) {
    applyStreamEvent(event, textParts);
  }

  const text = stripLeakedThinkingText(textParts.join(""));
  if (!text) {
    if (raw.trim() && events.length === 0) {
      throw new AgentSessionError(
        "Vertex AI agent returned unparseable stream response",
      );
    }
    throw new AgentSessionError("Vertex AI agent returned empty response");
  }

  return {
    role: "agent",
    text,
  };
}

/** Merge free text and optional UI chips into one agent message (#44). */
export function buildAgentUserMessage(text: string, chips?: string[]): string {
  const trimmed = text.trim();
  if (!chips?.length) {
    return trimmed;
  }
  const chipLine = chips.map((chip) => chip.trim()).filter(Boolean).join(" / ");
  if (!chipLine) {
    return trimmed;
  }
  return `${trimmed}\n[${chipLine}]`;
}
