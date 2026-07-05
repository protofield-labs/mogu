import { AgentSessionError, AgentSessionNotFoundError } from "./errors";
import type { AgentMessage } from "./types";

type StreamEvent = {
  error_code?: string;
  error_message?: string;
  message?: string;
  content?: {
    parts?: Array<{ text?: string }>;
  };
};

/** Extract top-level JSON objects from NDJSON or concatenated JSON (#44). */
export function extractJsonObjects(raw: string): StreamEvent[] {
  const events: StreamEvent[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escape = false;

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
          // Skip malformed object; continue scanning for valid objects.
        }
        start = -1;
      }
    }
  }

  return events;
}

function processStreamEvent(event: StreamEvent, textParts: string[]): void {
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

/** Parse Reasoning Engine :streamQuery body into AgentMessage (#44). */
export function parseAgentStreamResponse(raw: string): AgentMessage {
  const textParts: string[] = [];
  const events = extractJsonObjects(raw);

  for (const event of events) {
    processStreamEvent(event, textParts);
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
