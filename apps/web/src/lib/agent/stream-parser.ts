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

  const text = textParts.join("").trim();
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
