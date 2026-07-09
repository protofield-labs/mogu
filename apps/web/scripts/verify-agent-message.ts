/**
 * Agent message helpers verification (#44 Definition of Done).
 * Run via: pnpm exec tsx scripts/verify-agent-message.ts
 */
import { assert } from "./test-helpers/assert";

import {
  buildAgentUserMessage,
  parseAgentStreamResponse,
  stripLeakedThinkingText,
} from "../src/lib/agent/stream-parser";
import { isValidSessionId } from "../src/lib/agent/session-id";

function main() {
  assert(isValidSessionId("8508595470556200960"), "numeric session id valid");
  assert(!isValidSessionId("../sessions/other"), "reject path injection");
  assert(!isValidSessionId(""), "reject empty session id");

  assert(
    buildAgentUserMessage("今夜は静かな店", ["渋谷", "2人"]) ===
      "今夜は静かな店\n[渋谷 / 2人]",
    "merge text and chips",
  );
  assert(
    buildAgentUserMessage("  hello  ") === "hello",
    "trim text without chips",
  );

  assert(
    stripLeakedThinkingText("今夜はどんな気分？") === "今夜はどんな気分？",
    "keep normal Japanese reply",
  );
  assert(
    stripLeakedThinkingText(
      "Thinking Process: 1. **User's input:** hello\n2. Respond casually",
    ) === "",
    "drop thinking-only response",
  );
  assert(
    stripLeakedThinkingText(
      "Thinking Process: analyze mood\n\n今夜はどんな気分？",
    ) === "今夜はどんな気分？",
    "keep reply after thinking block",
  );
  assert(
    stripLeakedThinkingText(
      "Chain of Thought: step\n\nThinking Process: more",
    ) === "",
    "drop when remainder is still thinking",
  );
  assert(
    stripLeakedThinkingText("Thinking Process: 今夜はどんな気分？") ===
      "今夜はどんな気分？",
    "keep same-line reply after label",
  );
  assert(
    stripLeakedThinkingText("Thinking Process:\n今夜はどんな気分？") ===
      "今夜はどんな気分？",
    "keep next-line reply without blank line",
  );
  assert(
    stripLeakedThinkingText(
      "Thinking Process: reason\n\n1. 渋谷の居酒屋がおすすめ\n2. 予算は中くらい",
    ) === "1. 渋谷の居酒屋がおすすめ\n2. 予算は中くらい",
    "keep numbered Japanese reply list",
  );

  const parsed = parseAgentStreamResponse(
    [
      '{"content":{"parts":[{"text":"こんにちは。"}]}}',
      '{"content":{"parts":[{"text":"エリアを教えてください。"}]}}',
    ].join("\n"),
  );
  assert(parsed.role === "agent", "agent role");
  assert(
    parsed.text === "こんにちは。エリアを教えてください。",
    "concat stream text parts",
  );

  const stripped = parseAgentStreamResponse(
    '{"content":{"parts":[{"text":"Thinking Process: reason\\n\\n渋谷あたりでどう？"}]}}',
  );
  assert(stripped.text === "渋谷あたりでどう？", "strip thinking in parseAgentStreamResponse");

  const concatenated = parseAgentStreamResponse(
    '{"content":{"parts":[{"text":"A"}]}}{"content":{"parts":[{"text":"B"}]}}',
  );
  assert(concatenated.text === "AB", "parse concatenated JSON on one line");

  const withTrailing404 = parseAgentStreamResponse(
    [
      '{"content":{"parts":[{"text":"回答です。"}]}}',
      '{"message":"404 metadata only"}',
    ].join("\n"),
  );
  assert(
    withTrailing404.text === "回答です。",
    "ignore 404-like message after agent text collected",
  );

  let threw = false;
  try {
    parseAgentStreamResponse('{"error_code":"ClientError","error_message":"boom"}');
  } catch (error) {
    threw = true;
    assert(
      error instanceof Error && error.message === "boom",
      "surface stream error_message",
    );
  }
  assert(threw, "stream error raises");

  console.log("PASS: agent message helpers");
}

main();
