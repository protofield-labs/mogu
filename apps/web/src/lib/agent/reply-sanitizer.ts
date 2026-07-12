import {
  AGENT_PERSONAS,
  buildPersonaCollectionHintsRecord,
  buildPersonaReferenceLinePattern,
  buildPersonaThinkingRecord,
  type PersonaKey,
} from "./persona-config";

export type { PersonaKey };

/** Role + name thinking labels so first-time users get context (#288). */
export const PERSONA_THINKING = buildPersonaThinkingRecord();

/** Demo-fixed collection labels aligned with AGENT_PERSONAS (#270/#271/#288 / #334). */
export const PERSONA_COLLECTION_HINTS = buildPersonaCollectionHintsRecord();

/** Internal persona "参照:" lines must not reach the user bubble (#270). */
const PERSONA_REFERENCE_LINE = buildPersonaReferenceLinePattern();

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
const PERSONA_PUBLIC_NAME =
  /(?:サク飲み担当|大人デート担当)?[ \t]*(?:(?<![一-龯ぁ-んァ-ヶー])(?:アオイ|あおい|ケン|けん)|\b(?:Aoi|AOI|Ken|KEN))(?:さん)?(?=が|の|から|へ|に|を|、|,)/g;
const PERSONA_RECOMMENDATION_ATTRIBUTION =
  /(?:サク飲み担当|大人デート担当)?[ \t]*(?:(?<![一-龯ぁ-んァ-ヶー])(?:アオイ|あおい|ケン|けん)|\b(?:Aoi|AOI|Ken|KEN))(?:さん)?のおすすめ/g;
const PERSONA_RATING_EVIDENCE =
  /(?:アオイ|あおい|Aoi|AOI|ケン|けん|Ken|KEN)(?:さん)?が[『「][^』」]+[』」]/g;
const DELEGATION_NARRATION_LINE = new RegExp(
  [
    `^\\s*${PERSONA_NAME}(?:さん)?(?:に相談|に聞|に頼|へ相談|へ聞|から提案|からの提案|に任せ|に確認)`,
    `『${PERSONA_NAME}』(?:さん)?(?:に相談|に聞|に頼|へ相談|へ聞)`,
    `^\\s*${PERSONA_NAME}さん[、,].{0,80}(?:ありますか|教えて|おすすめ)`,
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
    const rest = lines.slice(1).join("\n").trim();
    return rest ? `${afterLabel}\n${rest}` : afterLabel;
  }

  let index = 1;
  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (isLeakedThinkingLine(line)) {
      index++;
      continue;
    }
    if (!CJK_CHAR.test(line)) {
      index++;
      continue;
    }
    break;
  }

  return lines.slice(index).join("\n").trim();
}

/** Remove persona-delegation narration that leaked into the user bubble (#263). */
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

    if (internalAskOrReport.test(value)) {
      continue;
    }

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

/** Drop persona-internal "参照: …" labels before user-facing display (#270). */
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
 * Hide internal persona identities at every user-facing boundary (#330).
 * Keep this separate from sanitizeAgentReplyText so persona inference can
 * still inspect internal collection/name signals before display.
 */
export function sanitizeAgentPublicText(text: string): string {
  let sanitized = sanitizeAgentReplyText(text);
  for (const persona of AGENT_PERSONAS) {
    sanitized = sanitized.replaceAll(persona.collectionName, "好みの傾向");
  }
  return sanitized
    .replace(PERSONA_RECOMMENDATION_ATTRIBUTION, "この店がおすすめ")
    .replace(PERSONA_PUBLIC_NAME, "mogu")
    .replace(/moguの[『「]好みの傾向[』」](?:寄り|の雰囲気)?/g, "好みの傾向")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** Convert persona-backed recommendation evidence to neutral mogu wording (#330). */
export function sanitizeAgentPublicEvidence(evidence: string): string {
  const withoutPersonaRating = evidence.replace(
    PERSONA_RATING_EVIDENCE,
    "好みの傾向に一致",
  );
  return sanitizeAgentPublicText(withoutPersonaRating)
    .replace(/(?:好みの傾向に一致・){2,}/g, "好みの傾向に一致・")
    .trim();
}

/**
 * Infer which persona (ken/aoi) a turn leaned on (#270/#271).
 */
export function inferPersonaKey(
  text: string,
  thinkingMessages: string[] = [],
): PersonaKey | null {
  for (const persona of AGENT_PERSONAS) {
    if (
      text.includes(persona.collectionName) ||
      new RegExp(`${persona.displayName}の[『「].+?[』」]`).test(text) ||
      (persona.key === "ken" && /ケンの[『「].+?[』」]/.test(text)) ||
      (persona.key === "aoi" && /アオイの[『「].+?[』」]/.test(text))
    ) {
      return persona.key;
    }
  }

  for (let i = thinkingMessages.length - 1; i >= 0; i--) {
    const message = thinkingMessages[i];
    for (const persona of AGENT_PERSONAS) {
      if (message === persona.thinkingLabel) {
        return persona.key;
      }
    }
  }
  return null;
}

/** Infer a persona taste evidence fragment from reply text or thinking labels (#270/#271). */
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
  if (/^(?:Ken|Aoi|ケン|アオイ)が[『「]/.test(trimmed)) {
    return trimmed;
  }
  return trimmed ? `${tasteHint}・${trimmed}` : tasteHint;
}

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
