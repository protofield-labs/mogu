/**
 * Single-agent presentation verification (#330).
 * Run via: pnpm exec tsx scripts/verify-persona-intro.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { assert } from "./test-helpers/assert";
import { toPublicChatEntry } from "../src/lib/agent/chat-helpers";
import {
  sanitizeAgentPublicEvidence,
  sanitizeAgentPublicText,
} from "../src/lib/agent/reply-sanitizer";

const root = join(process.cwd(), "src");

function readSource(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

assert(
  sanitizeAgentPublicText("Kenの『中目黒サク飲み』寄りだとこの店。") ===
    "好みの傾向だとこの店。",
  "persona taste prose becomes neutral",
);
assert(
  sanitizeAgentPublicText("焼き鳥ケン、おすすめです。") ===
    "焼き鳥ケン、おすすめです。",
  "shop name containing persona name remains",
);
assert(
  sanitizeAgentPublicText("Kenのおすすめ") === "この店がおすすめ",
  "persona attribution becomes natural neutral copy",
);
assert(
  sanitizeAgentPublicText("一段落目です。\n\nAoiの『静かな二人時間』寄りです。") ===
    "一段落目です。\n\n好みの傾向です。",
  "public sanitizer preserves paragraph breaks",
);
assert(
  sanitizeAgentPublicEvidence("Aoiが『すき』・グループで2人が保存") ===
    "好みの傾向に一致・グループで2人が保存",
  "persona recommendation evidence becomes neutral",
);

const historicalEntry = toPublicChatEntry({
  id: "agent-history",
  kind: "agent",
  personaKey: "ken",
  text: "Kenの『中目黒サク飲み』寄りです。",
  quickReplies: ["Kenの好みで探す"],
});
assert(!historicalEntry.text.includes("Ken"), "history text hides persona");
assert(
  !historicalEntry.quickReplies?.some((reply) => reply.includes("Ken")),
  "history quick replies hide persona",
);

const bubbles = readSource("components/search/agent-chat-bubbles.tsx");
assert(bubbles.includes("<MoguBrandIcon"), "agent avatar uses mogu icon");
assert(!bubbles.includes("personaImageForPersonaKey"), "agent avatar hides persona image");
assert(!bubbles.includes("personaKey={entry.personaKey}"), "persona key is not rendered");
assert(
  bubbles.includes("onChipSelect(entry.quickReplies?.[index] ?? chip, chip)"),
  "quick replies display neutral labels but send original values",
);

const transcript = readSource("components/search/agent-chat-transcript.tsx");
assert(!transcript.includes("PersonaIntroCard"), "transcript hides persona intro");
assert(
  !transcript.includes("personaImageForThinkingMessage"),
  "thinking marker hides persona image",
);
assert(
  transcript.includes("moguがお店を探しています…"),
  "thinking marker uses neutral mogu copy",
);

const header = readSource("components/search/agent-chat-header.tsx");
assert(!header.includes("味覚アドバイザーの紹介"), "header hides persona intro control");
assert(!header.includes("showPersonaIntroAgain"), "header has no persona intro action");

console.log("PASS: single-agent presentation verified");
