/**
 * Agent chat UI helpers verification (#55 Definition of Done).
 * Run via: pnpm exec tsx scripts/verify-agent-chat.ts
 */
import {
  AGENT_FOOTER_CAPTION,
  AGENT_OPENING_MESSAGE,
  createAgentEntry,
  createUserEntry,
  createWelcomeEntry,
  formatAgentUserError,
  formatUserBubbleText,
  googleMapsPlaceUrl,
  isRecommendation,
  openNowLabel,
  parseSseBuffer,
} from "../src/lib/agent/chat-helpers";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function main() {
  assert(
    createWelcomeEntry().text === AGENT_OPENING_MESSAGE,
    "welcome message copy",
  );
  assert(AGENT_FOOTER_CAPTION.includes("コレクション"), "footer caption");

  const user = createUserEntry("中目黒で3人", ["半個室"]);
  if (user.kind !== "user") {
    throw new Error("expected user entry");
  }
  assert(
    formatUserBubbleText(user) === "中目黒で3人\n[半個室]",
    "user bubble merges chips",
  );

  const chipSend = createUserEntry("サク飲み");
  if (chipSend.kind !== "user") {
    throw new Error("expected user entry");
  }
  assert(formatUserBubbleText(chipSend) === "サク飲み", "chip-only send text");

  const agent = createAgentEntry({
    text: "用途はどれが近い？",
    quickReplies: ["半個室", "サク飲み", "じっくり"],
  });
  if (agent.kind !== "agent") {
    throw new Error("expected agent entry");
  }
  assert(agent.quickReplies?.length === 3, "agent quick replies preserved");

  const sse = parseSseBuffer(
    'data: {"type":"thinking","message":"Kenのコレクションを参照中…","timestamp":"t1"}\n\n: keepalive\n\ndata: {"type":"done","message":"ok","timestamp":"t2"}\n\n',
  );
  assert(sse.events.length === 2, "parse two SSE data frames");
  assert(sse.events[0]?.type === "thinking", "first event type");
  assert(sse.remainder === "", "consume full buffer");

  const partial = parseSseBuffer('data: {"type":"thinking"');
  assert(partial.events.length === 0, "hold partial frame");
  assert(partial.remainder.startsWith("data:"), "partial remainder kept");

  assert(
    googleMapsPlaceUrl("ChIJ123").includes("query_place_id=ChIJ123"),
    "maps url uses place id",
  );
  assert(openNowLabel(true) === "営業中", "open now label");
  assert(openNowLabel(undefined) === null, "unknown open now");

  assert(
    isRecommendation({
      assertion: "ここがおすすめ",
      evidence: "Kenのコレクションに3件",
      spot: { id: "s1" },
      alternatives: [],
    }),
    "recommendation guard accepts shape",
  );
  assert(!isRecommendation({ text: "nope" }), "reject non recommendation");

  assert(
    formatAgentUserError(
      new Error("Agent Engine is not configured"),
      "fallback",
    ) === "エージェントが準備中です。しばらくしてから再度お試しください",
    "agent engine 503 copy",
  );
  assert(
    formatAgentUserError(new Error("Failed to fetch"), "fallback") ===
      "通信に失敗しました。接続を確認してください",
    "network error copy",
  );
  assert(
    formatAgentUserError(new Error("Failed to create agent session"), "開始失敗") ===
      "開始失敗",
    "generic session fallback",
  );

  console.log("PASS: agent chat helpers");
}

main();
