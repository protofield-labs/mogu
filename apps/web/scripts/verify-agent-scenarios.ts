/**
 * Demo scenario expectations for agent routing / evidence / follow-up (#264/#288).
 * Static regression — not a live LLM eval.
 * Run via: pnpm exec tsx scripts/verify-agent-scenarios.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { assert } from "./test-helpers/assert";
import { isSamePlaceFollowUp } from "../src/lib/agent/followup-context";
import {
  inferPersonaKey,
  PERSONA_COLLECTION_HINTS,
  PERSONA_THINKING,
} from "../src/lib/agent/stream-parser";

const agentsRoot = join(process.cwd(), "..", "..", "agents");

function readAgent(relativePath: string): string {
  return readFileSync(join(agentsRoot, relativePath), "utf8");
}

/** Scenario: izakaya → Ken */
assert(
  inferPersonaKey("Kenの『中目黒サク飲み』寄りだとこの店。", []) === "ken",
  "scenario: ken taste prose → ken",
);
assert(
  PERSONA_THINKING.ken.includes("サク飲み担当 Ken"),
  "scenario: ken thinking uses role+name (#288)",
);
assert(
  PERSONA_THINKING.aoi.includes("大人デート担当 Aoi"),
  "scenario: aoi thinking uses role+name (#288)",
);

/** Scenario: date night → Aoi */
assert(
  inferPersonaKey("", [PERSONA_THINKING.aoi!]) === "aoi",
  "scenario: aoi thinking → aoi",
);
assert(
  PERSONA_COLLECTION_HINTS.aoi?.collection === "静かな二人時間",
  "scenario: aoi collection label",
);
assert(
  PERSONA_COLLECTION_HINTS.ken?.role === "サク飲み担当",
  "scenario: ken role label (#288)",
);

/** Scenario: follow-up keeps place */
assert(
  isSamePlaceFollowUp("この店のおすすめの理由は？"),
  "scenario: why-this-place is same-place follow-up",
);
assert(
  !isSamePlaceFollowUp("恵比寿で別の店を探して"),
  "scenario: new area search is not same-place",
);

const orchestrator = readAgent("mogu/agent.py");
assert(
  orchestrator.includes("フォローアップで別店にすり替えない") ||
    orchestrator.includes("place_id"),
  "scenario: orchestrator instructs same-place follow-up",
);
assert(
  orchestrator.includes("不要な委譲をしない"),
  "scenario: orchestrator avoids unnecessary child calls (cost)",
);
assert(
  orchestrator.includes("enable_tracing=True"),
  "scenario: tracing enabled for cost/observability",
);
assert(
  orchestrator.includes("サク飲み担当 Ken") &&
    orchestrator.includes("大人デート担当 Aoi"),
  "scenario: orchestrator evidence examples use role+name (#288)",
);

const ken = readAgent("mogu/personas/ken.py");
assert(
  ken.includes("ペルソナコレクション実データ"),
  "scenario: ken uses prefetch block when present",
);
assert(ken.includes("同一 place_id"), "scenario: ken keeps place on follow-up");

const aoi = readAgent("mogu/personas/aoi.py");
assert(
  aoi.includes("ペルソナコレクション実データ"),
  "scenario: aoi uses prefetch block when present",
);
assert(aoi.includes("同一 place_id"), "scenario: aoi keeps place on follow-up");

console.log("PASS: agent scenarios verified");
