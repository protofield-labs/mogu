/**
 * Agent message helpers verification (#44 Definition of Done).
 * Run via: pnpm exec tsx scripts/verify-agent-message.ts
 */
import { assert } from "./test-helpers/assert";

import {
  buildAgentUserMessage,
  inferPersonaTasteEvidence,
  parseAgentStreamResponse,
  PERSONA_COLLECTION_HINTS,
  PERSONA_THINKING,
  sanitizeAgentPublicEvidence,
  sanitizeAgentPublicText,
  stripDelegationNarration,
  stripLeakedThinkingText,
  stripPersonaReferenceLines,
  withPersonaTasteEvidence,
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

  assert(
    stripDelegationNarration(
      "特別なディナーが楽しめるお店に詳しい『アオイ』に相談してみましょう。\n中目黒なら落ち着いた店がいいですね。",
    ) === "中目黒なら落ち着いた店がいいですね。",
    "drop consult-narration line",
  );
  assert(
    stripDelegationNarration(
      "アオイさん、中目黒でプロポーズにふさわしいお店はありますか？\nキャンドルが似合う静かな店がおすすめです。",
    ) === "キャンドルが似合う静かな店がおすすめです。",
    "drop internal ask-to-persona line",
  );
  assert(
    stripDelegationNarration("アオイから提案がありました。\nこちらはどうでしょう。") ===
      "こちらはどうでしょう。",
    "drop persona-report narration",
  );
  assert(
    stripDelegationNarration(
      "アオイに相談してみましょう。中目黒なら落ち着いた店がいいですね。",
    ) === "中目黒なら落ち着いた店がいいですね。",
    "keep reply after same-line narration",
  );
  assert(
    stripDelegationNarration("エリアを教えてもらえると相談してみましょう。") ===
      "エリアを教えてもらえると相談してみましょう。",
    "keep generic consult CTA without persona name",
  );
  assert(
    stripDelegationNarration("焼き鳥ケン、おすすめです。") ===
      "焼き鳥ケン、おすすめです。",
    "keep shop name ending with Ken",
  );
  assert(
    stripDelegationNarration("焼き鳥ケンさん、おすすめです。") ===
      "焼き鳥ケンさん、おすすめです。",
    "keep shop name with さん honorific",
  );
  assert(
    stripDelegationNarration(
      "特別なディナーが楽しめるお店に詳しい『アオイ』に相談してみましょう。",
    ) === "",
    "drop quoted-persona consult narration",
  );
  assert(
    stripDelegationNarration(
      "アオイに相談する前に、エリアを教えてください。",
    ) === "エリアを教えてください。",
    "keep clarifying ask after comma-clause narration",
  );
  assert(
    stripDelegationNarration("今夜はどんな気分？") === "今夜はどんな気分？",
    "keep normal reply without narration",
  );

  assert(
    stripPersonaReferenceLines(
      "参照: Kenのコレクション『中目黒サク飲み』（居酒屋・コスパ・友人）\n渋谷ならこの店がいい。",
    ) === "渋谷ならこの店がいい。",
    "drop persona reference line",
  );
  assert(
    stripPersonaReferenceLines(
      "参照: Kenのコレクション『中目黒サク飲み』（居酒屋・コスパ・友人）。渋谷ならこの店がいい。",
    ) === "渋谷ならこの店がいい。",
    "keep same-line proposal after reference label",
  );
  assert(
    stripPersonaReferenceLines("Kenの『中目黒サク飲み』寄りだとこの店。") ===
      "Kenの『中目黒サク飲み』寄りだとこの店。",
    "keep taste prose internally for persona inference",
  );
  assert(
    sanitizeAgentPublicText("Kenの『中目黒サク飲み』寄りだとこの店。") ===
      "好みの傾向だとこの店。",
    "hide persona taste prose at public boundary",
  );
  assert(
    sanitizeAgentPublicEvidence("Kenが『すき』・グループで4人が保存") ===
      "好みの傾向に一致・グループで4人が保存",
    "hide persona identity in recommendation evidence",
  );

  assert(
    inferPersonaTasteEvidence(
      "Aoiの『静かな二人時間』の雰囲気だとこの店。",
      [PERSONA_THINKING.ken!],
    ) === PERSONA_COLLECTION_HINTS.aoi!.evidence,
    "prefer reply text over earlier thinking",
  );
  assert(
    inferPersonaTasteEvidence("今夜はおすすめです", [
      PERSONA_THINKING.ken!,
      PERSONA_THINKING.aoi!,
    ]) === PERSONA_COLLECTION_HINTS.aoi!.evidence,
    "use last thinking label when reply has no taste prose",
  );
  assert(
    withPersonaTasteEvidence(
      "輪で4人が保存",
      PERSONA_COLLECTION_HINTS.ken!.evidence,
    ) === `${PERSONA_COLLECTION_HINTS.ken!.evidence}・輪で4人が保存`,
    "prefix persona taste onto evidence",
  );
  assert(
    withPersonaTasteEvidence(
      `${PERSONA_COLLECTION_HINTS.ken!.evidence}・輪で4人が保存`,
      PERSONA_COLLECTION_HINTS.ken!.evidence,
    ) === `${PERSONA_COLLECTION_HINTS.ken!.evidence}・輪で4人が保存`,
    "do not double-prefix evidence",
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

  const withoutPersonaText = parseAgentStreamResponse(
    [
      '{"author":"aoi","content":{"parts":[{"text":"アオイの内部提案です。"}]}}',
      '{"author":"mogu_orchestrator","content":{"parts":[{"text":"中目黒の静かな店がおすすめです。"}]}}',
    ].join("\n"),
  );
  assert(
    withoutPersonaText.text === "中目黒の静かな店がおすすめです。",
    "prefer orchestrator text over persona",
  );

  const personaFallback = parseAgentStreamResponse(
    '{"author":"aoi","content":{"parts":[{"text":"キャンドルが似合う静かな店がおすすめです。"}]}}',
  );
  assert(
    personaFallback.text === "キャンドルが似合う静かな店がおすすめです。",
    "fall back to persona text when orchestrator is silent",
  );

  const thinOrchestrator = parseAgentStreamResponse(
    [
      '{"author":"mogu_orchestrator","content":{"parts":[{"text":"わかりました。"}]}}',
      '{"author":"aoi","content":{"parts":[{"text":"1. 中目黒の静かな店がおすすめ\\n2. キャンドルが似合う雰囲気"}]}}',
    ].join("\n"),
  );
  assert(
    thinOrchestrator.text.includes("中目黒の静かな店がおすすめ"),
    "prefer richer persona reply over thin orchestrator ack",
  );

  const keepClarifying = parseAgentStreamResponse(
    [
      '{"author":"mogu_orchestrator","content":{"parts":[{"text":"どのエリアですか？"}]}}',
      '{"author":"aoi","content":{"parts":[{"text":"1. 中目黒の静かな店がおすすめ"}]}}',
    ].join("\n"),
  );
  assert(
    keepClarifying.text === "どのエリアですか？",
    "keep orchestrator clarifying question over persona proposal",
  );

  const narrationFiltered = parseAgentStreamResponse(
    '{"content":{"parts":[{"text":"アオイに相談してみましょう。\\nキャンドルが似合う店がいいですね。"}]}}',
  );
  assert(
    narrationFiltered.text === "キャンドルが似合う店がいいですね。",
    "strip delegation narration in parseAgentStreamResponse",
  );

  const referenceFiltered = parseAgentStreamResponse(
    '{"author":"ken","content":{"parts":[{"text":"参照: Kenのコレクション『中目黒サク飲み』（居酒屋・コスパ・友人）\\n渋谷の居酒屋がおすすめです。"}]}}',
  );
  assert(
    referenceFiltered.text === "渋谷の居酒屋がおすすめです。",
    "strip persona reference lines in parseAgentStreamResponse",
  );

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
