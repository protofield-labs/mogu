import type { ChatEntry } from "@/lib/agent/chat-helpers";

const MAX_TITLE_LENGTH = 40;

/** First user turn, or a fallback label for empty threads. */
export function buildConsultationTitle(entries: ChatEntry[]): string {
  const firstUser = entries.find(
    (entry): entry is Extract<ChatEntry, { kind: "user" }> => entry.kind === "user",
  );
  if (firstUser) {
    const trimmed = firstUser.text.trim();
    if (trimmed.length > 0) {
      return trimmed.length > MAX_TITLE_LENGTH
        ? `${trimmed.slice(0, MAX_TITLE_LENGTH)}…`
        : trimmed;
    }
  }
  return "新しい相談";
}
