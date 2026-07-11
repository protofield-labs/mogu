import { AgentSessionError, AgentSessionNotFoundError } from "./errors";
import {
  PERSONA_COLLECTION_HINTS,
  PERSONA_THINKING,
  resolveAgentReplyText,
} from "./reply-sanitizer";
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

export { PERSONA_THINKING, PERSONA_COLLECTION_HINTS } from "./reply-sanitizer";
export {
  inferPersonaKey,
  inferPersonaTasteEvidence,
  resolveAgentReplyText,
  sanitizeAgentReplyText,
  stripDelegationNarration,
  stripLeakedThinkingText,
  stripPersonaReferenceLines,
  withPersonaTasteEvidence,
} from "./reply-sanitizer";

const PERSONA_AUTHORS = new Set(Object.keys(PERSONA_THINKING));

const PERSONA_REFERENCE_LINE =
  /(?:^|\n)\s*(?:参照\s*[:：]|Kenのコレクション|Aoiのコレクション|ケンのコレクション|アオイのコレクション)/u;

function isPersonaKey(value: string): value is "ken" | "aoi" {
  return value === "ken" || value === "aoi";
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

export function applyStreamEvent(
  event: StreamEvent,
  textParts: string[],
  personaTextParts: string[] = [],
): void {
  if (event.error_code) {
    throw new AgentSessionError(
      event.error_message ?? event.message ?? "Vertex AI agent query failed",
    );
  }

  if (
    textParts.length === 0 &&
    personaTextParts.length === 0 &&
    typeof event.message === "string" &&
    event.message.startsWith("404")
  ) {
    throw new AgentSessionNotFoundError();
  }

  const author = event.author?.trim().toLowerCase();
  const isPersona = Boolean(author && PERSONA_AUTHORS.has(author));

  for (const part of event.content?.parts ?? []) {
    if (!part.text) {
      continue;
    }
    if (isPersona) {
      personaTextParts.push(part.text);
      continue;
    }
    textParts.push(part.text);
  }
}

function firstIndex(haystack: string, needle: string): number {
  const idx = haystack.indexOf(needle);
  return idx >= 0 ? idx : Number.POSITIVE_INFINITY;
}

function firstRegexIndex(haystack: string, pattern: RegExp): number {
  const match = pattern.exec(haystack);
  return match?.index ?? Number.POSITIVE_INFINITY;
}

function resolvePersonaKeyFromBlob(blob: string): "ken" | "aoi" | null {
  const lower = blob.toLowerCase();
  const kenIdx = Math.min(
    firstRegexIndex(lower, /(?:^|[^a-z0-9_])ken(?:[^a-z0-9_]|$)/i),
    firstIndex(blob, PERSONA_COLLECTION_HINTS.ken!.collection),
    firstRegexIndex(blob, /(?:^|[^\p{L}\p{N}])ケン(?:[^\p{L}\p{N}]|$)/u),
  );
  const aoiIdx = Math.min(
    firstRegexIndex(lower, /(?:^|[^a-z0-9_])aoi(?:[^a-z0-9_]|$)/i),
    firstIndex(blob, PERSONA_COLLECTION_HINTS.aoi!.collection),
    firstRegexIndex(
      blob,
      /(?:^|[^\p{L}\p{N}])(?:アオイ|あおい)(?:[^\p{L}\p{N}]|$)/u,
    ),
  );
  if (!Number.isFinite(kenIdx) && !Number.isFinite(aoiIdx)) {
    return null;
  }
  if (!Number.isFinite(aoiIdx) || kenIdx <= aoiIdx) {
    return "ken";
  }
  return "aoi";
}

function resolvePersonaFromFunctionCall(functionCall: unknown): "ken" | "aoi" | null {
  if (!functionCall || typeof functionCall !== "object") {
    return null;
  }
  const name =
    "name" in functionCall && typeof functionCall.name === "string"
      ? functionCall.name.toLowerCase()
      : "";
  if (name.includes("ken")) {
    return "ken";
  }
  if (name.includes("aoi")) {
    return "aoi";
  }
  return resolvePersonaKeyFromBlob(JSON.stringify(functionCall));
}

/** Map Vertex stream event to OpenAPI AgentEvent thinking (#45 / #270). */
export function extractThinkingEvent(event: StreamEvent): AgentEvent | null {
  const author = event.author?.trim().toLowerCase();
  const personaMessage =
    author && isPersonaKey(author) ? PERSONA_THINKING[author] : undefined;
  if (personaMessage) {
    return createThinkingEvent(personaMessage);
  }

  let genericToolThinking: AgentEvent | null = null;
  for (const part of event.content?.parts ?? []) {
    if (part.function_call) {
      const persona = resolvePersonaFromFunctionCall(part.function_call);
      if (persona) {
        return createThinkingEvent(PERSONA_THINKING[persona]!);
      }
      genericToolThinking ??= createThinkingEvent(
        "エージェントが情報を集めています…",
      );
      continue;
    }
    if (part.text) {
      if (PERSONA_REFERENCE_LINE.test(part.text) || /参照\s*[:：]/.test(part.text)) {
        const persona = resolvePersonaKeyFromBlob(part.text);
        if (persona) {
          return createThinkingEvent(PERSONA_THINKING[persona]!);
        }
      }
    }
  }

  return genericToolThinking;
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
  const personaTextParts: string[] = [];
  const events = extractJsonObjects(raw);

  for (const event of events) {
    applyStreamEvent(event, textParts, personaTextParts);
  }

  const text = resolveAgentReplyText(textParts.join(""), personaTextParts.join(""));
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
