/**
 * Agent consultation history verification (#153).
 * Run via: pnpm exec tsx scripts/verify-agent-consultations.ts
 */
import { assert } from "./test-helpers/assert";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  createAgentEntry,
  createUserEntry,
  createWelcomeEntry,
} from "../src/lib/agent/chat-helpers";
import { parseConsultationEntries } from "../src/lib/agent/consultation-entries";
import { buildConsultationTitle } from "../src/lib/agent/consultation-title";
import {
  syncAgentConsultationBodySchema,
} from "../src/lib/api/schemas/agent-consultations";

const root = join(process.cwd(), "src");

function readSource(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

const welcome = createWelcomeEntry();
const user = createUserEntry("中目黒で3人");
if (user.kind !== "user") {
  throw new Error("expected user entry");
}

assert(
  buildConsultationTitle([welcome]) === "新しい相談",
  "empty thread title fallback",
);
assert(
  buildConsultationTitle([welcome, user]) === "中目黒で3人",
  "title from first user turn",
);
assert(
  buildConsultationTitle([
    welcome,
    user,
    createAgentEntry({ text: "了解です" }),
  ]) === "中目黒で3人",
  "title ignores agent turns",
);

const longText = "あ".repeat(50);
const longUser = createUserEntry(longText);
if (longUser.kind !== "user") {
  throw new Error("expected user entry");
}
assert(
  buildConsultationTitle([longUser]).endsWith("…"),
  "truncate long consultation title",
);

const entries = [welcome, user, createAgentEntry({ text: "了解です" })];
assert(
  parseConsultationEntries(entries).length === 3,
  "parse valid consultation entries",
);
assert(parseConsultationEntries([{ kind: "user" }]).length === 0, "reject invalid entries");
assert(parseConsultationEntries(null).length === 0, "null entries become empty array");

const dal = readSource("lib/dal/agent-consultations.ts");
assert(dal.includes("AGENT_CONSULTATION_LIST_LIMIT = 20"), "list limit is 20");

assert(
  syncAgentConsultationBodySchema.safeParse({
    sessionId: "1234567890",
    entries,
  }).success,
  "sync body schema accepts chat entries",
);
assert(
  syncAgentConsultationBodySchema.safeParse({
    sessionId: "bad",
    entries,
  }).success === false,
  "sync body rejects invalid session id",
);

const agentChat = readSource("components/search/agent-chat.tsx");
const agentChatHook = readSource("lib/agent/use-agent-chat.ts");
assert(agentChat.includes("AgentConsultationHistorySheet"), "agent chat renders history sheet");
assert(
  agentChatHook.includes("applyConsultationDetail"),
  "agent chat hook resumes consultations",
);
assert(
  agentChatHook.includes("persistConsultationEntries"),
  "agent chat hook syncs consultation entries",
);
assert(
  agentChatHook.includes("syncAgentConsultationEntries"),
  "agent chat hook calls consultation sync api",
);
assert(
  agentChatHook.includes('consultationViewMode === "readonly"') ||
    agentChat.includes('consultationViewMode === "readonly"'),
  "readonly consultation mode",
);

const browserApi = readSource("lib/agent/browser-api.ts");
assert(browserApi.includes("listAgentConsultations"), "browser api lists consultations");
assert(browserApi.includes("fetchAgentConsultation"), "browser api fetches consultation detail");
assert(browserApi.includes("syncAgentConsultationEntries"), "browser api syncs initial entries");

assert(dal.includes("appendAgentConsultationTurn"), "dal appends turns");
assert(
  dal.includes("buildConsultationTitle(entries)"),
  "sync always updates consultation title",
);
assert(
  !dal.includes('entry.kind === "user"'),
  "sync no longer skips after user turns",
);
assert(dal.includes("createAgentConsultation"), "dal creates consultation rows");

console.log("PASS: agent consultation history verified");
