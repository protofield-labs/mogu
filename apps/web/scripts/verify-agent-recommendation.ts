/**
 * Agent recommendation verification (#161 / #270).
 * Run via: pnpm exec tsx scripts/verify-agent-recommendation.ts
 */
import { assert } from "./test-helpers/assert";

import { isAgentAssertionTurn } from "../src/lib/agent/assertion-turn";
import {
  inferPersonaTasteEvidence,
  withPersonaTasteEvidence,
} from "../src/lib/agent/stream-parser";

function main() {
  assert(
    isAgentAssertionTurn("今夜は中目黒のこの店がおすすめです。"),
    "detects assertion with おすすめ",
  );
  assert(
    !isAgentAssertionTurn("今夜はどんな気分ですか？"),
    "rejects clarifying question",
  );
  assert(
    !isAgentAssertionTurn("短い"),
    "rejects short text",
  );
  assert(
    isAgentAssertionTurn("恵比寿ならこちらの店に行くのがおすすめです"),
    "detects assertion with こちら and 行く",
  );
  assert(
    !isAgentAssertionTurn("恵比寿の店を探しています"),
    "rejects non-assertion explanation",
  );

  assert(
    withPersonaTasteEvidence(
      "Kenが『また行きたい』・輪で4人が保存",
      inferPersonaTasteEvidence("", ["Kenのコレクションを参照中…"]),
    ).startsWith("Kenの『渋谷ワイワイ飲み』寄り"),
    "assertion evidence can carry persona taste hint",
  );

  console.log("PASS: agent recommendation helpers verified");
}

main();
