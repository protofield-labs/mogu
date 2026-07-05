import { AgentSessionError } from "./errors";
import type { AgentMessage } from "./types";

type StreamEvent = {
  error_code?: string;
  error_message?: string;
  message?: string;
  content?: {
    parts?: Array<{ text?: string }>;
  };
};

/** Parse NDJSON from Reasoning Engine :streamQuery into AgentMessage (#44). */
export function parseAgentStreamResponse(raw: string): AgentMessage {
  const textParts: string[] = [];

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    let event: StreamEvent;
    try {
      event = JSON.parse(trimmed) as StreamEvent;
    } catch {
      continue;
    }

    if (event.error_code) {
      throw new AgentSessionError(
        event.error_message ?? event.message ?? "Vertex AI agent query failed",
      );
    }

    if (typeof event.message === "string" && event.message.startsWith("404")) {
      throw new AgentSessionError(event.message);
    }

    for (const part of event.content?.parts ?? []) {
      if (part.text) {
        textParts.push(part.text);
      }
    }
  }

  const text = textParts.join("").trim();
  if (!text) {
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
