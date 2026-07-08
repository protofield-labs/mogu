/**
 * Agent chat UI helpers verification (#55 Definition of Done).
 * Run via: pnpm exec tsx scripts/verify-agent-chat.ts
 */
import { assert } from "./test-helpers/assert";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  AGENT_OPENING_MESSAGE,
  createAgentEntry,
  createUserEntry,
  createWelcomeEntry,
  formatAgentUserError,
  formatUserBubbleText,
  googleMapsPlaceUrl,
  isAgentSessionUnavailableError,
  isRecommendation,
  openNowLabel,
  parseSseBuffer,
} from "../src/lib/agent/chat-helpers";
import { isAgentAssertionTurn } from "../src/lib/agent/assertion-turn";
import {
  AGENT_CHAT_SESSION_TTL_MS,
  isAgentReplyPending,
  isStoredAgentChatSessionFresh,
  loadAgentChatSession,
  parseStoredAgentChatSession,
  reconcileStoredAgentChatSession,
  type StoredAgentChatSession,
} from "../src/lib/agent/session-storage";
import {
  buildStructuredChipPrompt,
  structuredSelectionsToChips,
} from "../src/lib/agent/structured-chips";

const root = join(process.cwd(), "src");

function readSource(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

function main() {
  assert(
    createWelcomeEntry().text === AGENT_OPENING_MESSAGE,
    "welcome message copy",
  );

  const composer = readSource("components/search/agent-chat-composer.tsx");
  assert(!composer.includes("AGENT_FOOTER_CAPTION"), "composer omits footer caption");

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
    googleMapsPlaceUrl("ChIJ123").includes("destination_place_id=ChIJ123"),
    "maps url uses destination place id",
  );
  assert(
    googleMapsPlaceUrl({
      placeId: "ChIJ123",
      name: "テスト店",
    }).includes("destination="),
    "maps url includes destination label",
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
    isAgentAssertionTurn("今夜は中目黒のこの店がおすすめです。"),
    "assertion turn heuristic available",
  );

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

  const welcome = createWelcomeEntry();
  const storedPayload: StoredAgentChatSession = {
    userId: "user-abc",
    sessionId: "1234567890",
    entries: [welcome],
    savedAt: new Date().toISOString(),
  };
  const serialized = JSON.stringify(storedPayload);
  assert(
    parseStoredAgentChatSession(serialized)?.sessionId === storedPayload.sessionId,
    "parse stored session",
  );
  assert(
    loadAgentChatSession("user-abc") === null,
    "load requires browser sessionStorage",
  );
  assert(
    isStoredAgentChatSessionFresh(storedPayload),
    "fresh stored session within ttl",
  );
  assert(
    !isStoredAgentChatSessionFresh(
      {
        ...storedPayload,
        savedAt: new Date(Date.now() - AGENT_CHAT_SESSION_TTL_MS - 1).toISOString(),
      },
      Date.now(),
    ),
    "expired stored session rejected",
  );
  assert(parseStoredAgentChatSession('{"sessionId":"bad"}') === null, "reject invalid stored session");

  const pendingUser = createUserEntry("恵比寿で2人");
  if (pendingUser.kind !== "user") {
    throw new Error("expected user entry");
  }
  const pendingStored: StoredAgentChatSession = {
    userId: "user-abc",
    sessionId: "1234567890",
    entries: [welcome, pendingUser],
    pendingUserEntryId: pendingUser.id,
    savedAt: new Date().toISOString(),
  };
  assert(isAgentReplyPending(pendingStored), "detect pending agent reply");
  assert(
    !isAgentReplyPending({
      ...pendingStored,
      entries: [
        ...pendingStored.entries,
        createAgentEntry({ text: "ここがおすすめ" }),
      ],
    }),
    "completed turn is not pending",
  );
  assert(
    reconcileStoredAgentChatSession({
      ...pendingStored,
      entries: [
        ...pendingStored.entries,
        createAgentEntry({ text: "ここがおすすめ" }),
      ],
    }).pendingUserEntryId === undefined,
    "reconcile clears resolved pending marker",
  );

  const structuredSelections = { area: "恵比寿", party: "2人", mood: "サクッと" };
  assert(
    structuredSelectionsToChips(structuredSelections).join(",") === "恵比寿,2人,サクッと",
    "structured chip order follows groups",
  );
  assert(
    buildStructuredChipPrompt(structuredSelections) === "今夜は恵比寿・2人・サクッとで探しています",
    "structured chip prompt",
  );
  assert(buildStructuredChipPrompt({}) === "", "empty structured prompt");

  assert(
    isAgentSessionUnavailableError(new Error("対象が見つかりません")),
    "detect stale agent session from not_found copy",
  );
  assert(
    !isAgentSessionUnavailableError(new Error("通信に失敗しました")),
    "ignore unrelated errors",
  );

  console.log("PASS: agent chat helpers");
}

main();
