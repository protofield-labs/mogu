import type { Recommendation } from "@/lib/agent/types";
import {
  buildRecommendationContextMessage,
  type RecommendationContextInput,
} from "@/lib/agent/recommendation-context-message";

/**
 * Prepend active recommendation context so follow-up turns keep the same place (#264).
 * The user-visible transcript still shows only `userText`.
 */
export function buildFollowUpUserMessage(
  userText: string,
  active: RecommendationContextInput | null,
): string {
  const trimmed = userText.trim();
  if (!active) {
    return trimmed;
  }
  return [
    buildRecommendationContextMessage(active),
    "",
    "[ユーザーの発言]",
    trimmed,
  ].join("\n");
}

/**
 * True when the user is asking about the current recommendation, not a new search (#264).
 * Used to pin the assertion card spot and re-seed place context.
 */
export function isSamePlaceFollowUp(userText: string): boolean {
  const text = userText.trim();
  if (!text) {
    return false;
  }
  // Explicit "another place" — never pin.
  if (/別の店|他の店|違う店|ほかの店|別のお店|他のお店|違うお店/.test(text)) {
    return false;
  }
  // Fresh search ("探して") without referring to this place.
  if (
    /探して|探してる|探しています/.test(text) &&
    !/この店|その店|このお店|そのお店/.test(text)
  ) {
    return false;
  }
  return /この店|その店|このお店|そのお店|なんで|なぜ|理由|もっと|詳しく|どうして|おすすめの理由|ここが|そこに/.test(
    text,
  );
}

/** Latest agent recommendation in consultation history (newest wins). */
export function findLatestRecommendation(
  entries: Array<{ kind: string; recommendation?: Recommendation }>,
): Recommendation | null {
  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const entry = entries[i];
    if (entry?.kind === "agent" && entry.recommendation) {
      return entry.recommendation;
    }
  }
  return null;
}
