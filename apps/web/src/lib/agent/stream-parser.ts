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

export const PERSONA_THINKING: Record<string, string> = {
  ken: "Kenのコレクションを参照中…",
  aoi: "Aoiのコレクションを参照中…",
};

/** Demo-fixed collection labels aligned with seed DEMO_PERSONAS (#270/#271). */
export const PERSONA_COLLECTION_HINTS: Record<
  string,
  { collection: string; evidence: string; demoUid: string }
> = {
  ken: {
    collection: "中目黒サク飲み",
    evidence: "Kenの『中目黒サク飲み』寄り",
    demoUid: "demo-ken",
  },
  aoi: {
    collection: "静かな二人時間",
    evidence: "Aoiの『静かな二人時間』寄り",
    demoUid: "demo-aoi",
  },
};

const PERSONA_AUTHORS = new Set(Object.keys(PERSONA_THINKING));

/** Internal persona "参照:" lines must not reach the user bubble (#270). */
const PERSONA_REFERENCE_LINE =
  /^\s*参照\s*[:：].*(?:コレクション|Ken|Aoi|ケン|アオイ|中目黒サク飲み|静かな二人時間)/i;

/** Labels Gemini sometimes leaks into text parts (#251). */
const LEAKED_THINKING_LABEL =
  /^(?:thinking\s*process|chain\s*of\s*thought|internal\s*monologue)\s*:?\s*/i;

const CJK_CHAR = /[\u3040-\u30ff\u3400-\u9fff\uff66-\uff9d]/;

/**
 * Orchestrator sometimes narrates AgentTool delegation to the user (#263).
 * Require persona name at line start (or 『』 wrap) so shop names like
 * 「焼き鳥ケン」 are not treated as the Ken persona.
 */
const PERSONA_NAME = "(?:アオイ|あおい|Aoi|AOI|ケン|けん|Ken|KEN)";
const DELEGATION_NARRATION_LINE = new RegExp(
  [
    // Line-leading: 「アオイに相談してみましょう」
    `^\\s*${PERSONA_NAME}(?:さん)?(?:に相談|に聞|に頼|へ相談|へ聞|から提案|からの提案|に任せ|に確認)`,
    // 『アオイ』 anywhere (quoted persona label from the repro)
    `『${PERSONA_NAME}』(?:さん)?(?:に相談|に聞|に頼|へ相談|へ聞)`,
    // Line-leading internal ask: 「アオイさん、〜ありますか？」
    `^\\s*${PERSONA_NAME}さん[、,].{0,80}(?:ありますか|教えて|おすすめ)`,
    // Line-leading report: 「アオイから提案がありました」
    `^\\s*${PERSONA_NAME}(?:さん)?から提案がありました`,
  ].join("|"),
  "i",
);

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

/**
 * Remove persona-delegation narration that leaked into the user bubble (#263).
 * Drops narration-only lines; for mixed lines, keeps non-narration clauses.
 */
export function stripDelegationNarration(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return "";
  }

  const internalAskOrReport = new RegExp(
    [
      `^\\s*${PERSONA_NAME}さん[、,]`,
      `^\\s*${PERSONA_NAME}(?:さん)?から提案がありました`,
    ].join("|"),
    "i",
  );

  const keptLines: string[] = [];
  for (const line of trimmed.split(/\r?\n/)) {
    const value = line.trim();
    if (!value) {
      keptLines.push(line);
      continue;
    }
    if (!DELEGATION_NARRATION_LINE.test(value)) {
      keptLines.push(line);
      continue;
    }

    // Internal asks / reports are narration-only — drop the whole line.
    if (internalAskOrReport.test(value)) {
      continue;
    }

    // Mixed lines like 「アオイに相談する前に、エリアを教えてください。」
    const clauses = value
      .split(/(?<=[。！？])|(?<=、)/)
      .map((clause) => clause.trim())
      .filter(Boolean);
    const keptClauses = clauses.filter(
      (clause) => !DELEGATION_NARRATION_LINE.test(clause),
    );
    if (keptClauses.length > 0) {
      keptLines.push(keptClauses.join("").replace(/^、+/, "").trim());
    }
  }

  return keptLines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Drop persona-internal "参照: …" labels before user-facing display (#270).
 * Orchestrator should already rewrite these into natural prose; this is a guard.
 * Same-line proposals after the label are kept.
 */
export function stripPersonaReferenceLines(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return "";
  }
  const kept: string[] = [];
  for (const line of trimmed.split(/\r?\n/)) {
    const value = line.trim();
    if (!value) {
      kept.push(line);
      continue;
    }
    if (!PERSONA_REFERENCE_LINE.test(value) && !/^\s*参照\s*[:：]/.test(value)) {
      kept.push(line);
      continue;
    }
    // Drop the "参照: …" clause; keep any trailing proposal on the same line.
    const withoutLabel = value
      .replace(/^\s*参照\s*[:：][^\n。！？]*/u, "")
      .replace(/^[。．\s]+/, "")
      .trim();
    if (withoutLabel) {
      kept.push(withoutLabel);
    }
  }
  return kept
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Final cleanup before display/persist (#251 + #263 + #270). */
export function sanitizeAgentReplyText(text: string): string {
  return stripPersonaReferenceLines(
    stripDelegationNarration(stripLeakedThinkingText(text)),
  );
}

/**
 * Infer which persona (ken/aoi) a turn leaned on (#270/#271).
 * Prefer the final reply text so mid-turn delegation thinking does not override
 * the persona the orchestrator actually used in the user-facing answer.
 */
export function inferPersonaKey(
  text: string,
  thinkingMessages: string[] = [],
): "ken" | "aoi" | null {
  const kenHint = PERSONA_COLLECTION_HINTS.ken!;
  const aoiHint = PERSONA_COLLECTION_HINTS.aoi!;
  if (
    text.includes(kenHint.collection) ||
    /Kenの[『「].+?[』」]/.test(text) ||
    /ケンの[『「].+?[』」]/.test(text)
  ) {
    return "ken";
  }
  if (
    text.includes(aoiHint.collection) ||
    /Aoiの[『「].+?[』」]/.test(text) ||
    /アオイの[『「].+?[』」]/.test(text)
  ) {
    return "aoi";
  }

  for (let i = thinkingMessages.length - 1; i >= 0; i--) {
    const message = thinkingMessages[i];
    if (message === PERSONA_THINKING.ken) {
      return "ken";
    }
    if (message === PERSONA_THINKING.aoi) {
      return "aoi";
    }
  }
  return null;
}

/**
 * Infer a persona taste evidence fragment from reply text or thinking labels (#270/#271).
 */
export function inferPersonaTasteEvidence(
  text: string,
  thinkingMessages: string[] = [],
): string | null {
  const persona = inferPersonaKey(text, thinkingMessages);
  return persona ? PERSONA_COLLECTION_HINTS[persona]!.evidence : null;
}

/** Prefixed evidence when a persona taste hint is available (#270/#271). */
export function withPersonaTasteEvidence(
  evidence: string,
  tasteHint: string | null,
): string {
  const trimmed = evidence.trim();
  if (!tasteHint) {
    return trimmed;
  }
  if (trimmed.includes(tasteHint)) {
    return trimmed;
  }
  // Home-style evidence already names the person (「Kenが『すき』…」).
  if (/^(?:Ken|Aoi|ケン|アオイ)が[『「]/.test(trimmed)) {
    return trimmed;
  }
  return trimmed ? `${tasteHint}・${trimmed}` : tasteHint;
}

/** Only treat pure acknowledgements as thin — keep clarifying questions. */
const THIN_ORCHESTRATOR_REPLY =
  /^(?:わかりました|了解です|少々お待ちください|お待ちください|確認します|調べます|はい)[。．!！…]*$/;

function isThinOrchestratorReply(text: string): boolean {
  return THIN_ORCHESTRATOR_REPLY.test(text.trim());
}

/**
 * Prefer orchestrator text; fall back to persona when primary is empty or a pure ack (#263).
 */
export function resolveAgentReplyText(
  orchestratorText: string,
  personaText = "",
): string {
  const primary = sanitizeAgentReplyText(orchestratorText);
  const fallback = sanitizeAgentReplyText(personaText);
  if (!primary) {
    return fallback;
  }
  if (!fallback) {
    return primary;
  }
  if (isThinOrchestratorReply(primary) && fallback.length > primary.length) {
    return fallback;
  }
  return primary;
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
      // Keep persona text as fallback if orchestrator never emits a final reply.
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
    firstIndex(blob, "中目黒サク飲み"),
    firstRegexIndex(blob, /(?:^|[^\p{L}\p{N}])ケン(?:[^\p{L}\p{N}]|$)/u),
  );
  const aoiIdx = Math.min(
    firstRegexIndex(lower, /(?:^|[^a-z0-9_])aoi(?:[^a-z0-9_]|$)/i),
    firstIndex(blob, "静かな二人時間"),
    firstRegexIndex(blob, /(?:^|[^\p{L}\p{N}])(?:アオイ|あおい)(?:[^\p{L}\p{N}]|$)/u),
  );

  if (!Number.isFinite(kenIdx) && !Number.isFinite(aoiIdx)) {
    return null;
  }
  if (!Number.isFinite(aoiIdx) || kenIdx <= aoiIdx) {
    return Number.isFinite(kenIdx) ? "ken" : "aoi";
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
  const personaMessage = author ? PERSONA_THINKING[author] : undefined;
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
