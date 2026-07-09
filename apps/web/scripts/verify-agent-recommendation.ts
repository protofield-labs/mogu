/**
 * Agent recommendation verification (#161 / #270 / #271).
 * Run via: pnpm exec tsx scripts/verify-agent-recommendation.ts
 */
import { Rating } from "@prisma/client";

import { assert } from "./test-helpers/assert";

import { isAgentAssertionTurn } from "../src/lib/agent/assertion-turn";
import {
  inferPersonaKey,
  inferPersonaTasteEvidence,
  withPersonaTasteEvidence,
} from "../src/lib/agent/stream-parser";
import { buildEvidence } from "../src/lib/recommendations/pick";

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
    inferPersonaKey("", ["Kenのコレクションを参照中…"]) === "ken",
    "infers ken persona key from thinking",
  );
  assert(
    inferPersonaKey("Aoiの『静かな二人時間』の雰囲気だとこの店。") === "aoi",
    "infers aoi persona key from prose",
  );

  const homeStyle = buildEvidence("Ken", Rating.again, 3);
  assert(
    withPersonaTasteEvidence(
      homeStyle,
      inferPersonaTasteEvidence("", ["Kenのコレクションを参照中…"]),
    ) === homeStyle,
    "keep home-style Ken evidence without double-prefix",
  );
  assert(
    withPersonaTasteEvidence(
      "Mikaが『すき』・グループで2人が保存",
      "Aoiの『静かな二人時間』寄り",
    ).startsWith("Aoiの『静かな二人時間』寄り・"),
    "prefix taste hint when friend name differs from persona",
  );

  console.log("PASS: agent recommendation helpers verified");
}

main();
