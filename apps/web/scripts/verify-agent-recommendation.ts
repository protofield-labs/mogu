/**
 * Agent recommendation verification (#161 / #270 / #271).
 * Run via: pnpm exec tsx scripts/verify-agent-recommendation.ts
 */
import { Rating } from "@prisma/client";

import { assert } from "./test-helpers/assert";

import { isAgentAssertionTurn } from "../src/lib/agent/assertion-turn";
import {
  CANDIDATE_ONLY_REPLY_TEXT,
  RECOMMENDATION_RESOLUTION_FAILED_TEXT,
} from "../src/lib/agent/candidate-spot-markers";
import {
  inferPersonaKey,
  inferPersonaTasteEvidence,
  PERSONA_COLLECTION_HINTS,
  PERSONA_THINKING,
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
    inferPersonaKey("", [PERSONA_THINKING.ken!]) === "ken",
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
      inferPersonaTasteEvidence("", [PERSONA_THINKING.ken!]),
    ) === homeStyle,
    "keep home-style Ken evidence without double-prefix",
  );
  assert(
    withPersonaTasteEvidence(
      "Mikaが『すき』・グループで2人が保存",
      PERSONA_COLLECTION_HINTS.aoi!.evidence,
    ).startsWith(`${PERSONA_COLLECTION_HINTS.aoi!.evidence}・`),
    "prefix taste hint when friend name differs from persona",
  );

  assert(
    CANDIDATE_ONLY_REPLY_TEXT.length > 0,
    "candidate-only reply text is defined",
  );
  assert(
    RECOMMENDATION_RESOLUTION_FAILED_TEXT.length > 0,
    "recommendation resolution fallback text is defined",
  );

  console.log("PASS: agent recommendation helpers verified");
}

main();
