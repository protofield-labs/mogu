/**
 * Agent instruction language / routing / taste-hint guards (#251/#263/#269/#270).
 * Run via: pnpm exec tsx scripts/verify-agent-instructions.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { matchesCandidateMarkerLine } from "../src/lib/agent/candidate-spot-markers";

import { assert } from "./test-helpers/assert";

const agentsRoot = join(process.cwd(), "..", "..", "agents");

function readAgentSource(relativePath: string): string {
  return readFileSync(join(agentsRoot, relativePath), "utf8");
}

function assertJapanesePersona(source: string, label: string): void {
  assert(source.includes("日本語"), `${label} uses Japanese instruction`);
  assert(
    source.includes("Thinking Process") || source.includes("思考過程"),
    `${label} forbids thinking process output`,
  );
}

function main() {
  const orchestrator = readAgentSource("mogu/agent.py");
  assertJapanesePersona(orchestrator, "orchestrator");
  assert(
    orchestrator.includes("委譲・ツール呼び出し・子エージェントとのやり取りはユーザーに見せない") ||
      orchestrator.includes("委譲ナレーション"),
    "orchestrator hides persona dialogue",
  );
  assert(
    orchestrator.includes("一人の mogu") || orchestrator.includes("一人の mogu 相談相手"),
    "orchestrator speaks as one mogu",
  );
  assert(
    orchestrator.includes("振り分けルール") || orchestrator.includes("Ken ツールに委譲"),
    "orchestrator has explicit routing rules",
  );
  assert(
    orchestrator.includes("居酒屋") && orchestrator.includes("Ken"),
    "orchestrator routes izakaya/casual to Ken",
  );
  assert(
    orchestrator.includes("プロポーズ") && orchestrator.includes("Aoi"),
    "orchestrator routes proposal/quiet to Aoi",
  );
  assert(
    orchestrator.includes("聞き返す") || orchestrator.includes("曖昧"),
    "orchestrator clarifies when intent is ambiguous",
  );
  assert(
    orchestrator.includes("orchestrator 単独") ||
      orchestrator.includes("不要な委譲をしない"),
    "orchestrator avoids unnecessary delegation for small talk",
  );
  assert(
    orchestrator.includes("味覚の手がかり") ||
      orchestrator.includes("中目黒サク飲み") ||
      orchestrator.includes("静かな二人時間"),
    "orchestrator surfaces persona taste in final reply",
  );

  const markerContract = "[[候補 spot_id=";

  const personaBase = readAgentSource("mogu/personas/_base.py");
  assert(personaBase.includes("日本語"), "persona base uses Japanese instruction");
  assert(
    personaBase.includes("Thinking Process") || personaBase.includes("思考過程"),
    "persona base forbids thinking process output",
  );
  assert(
    personaBase.includes("ユーザーに直接話しかけない"),
    "persona base does not address the user directly",
  );
  assert(
    personaBase.includes("ペルソナコレクション実データ"),
    "persona base prefers prefetch collection data (#264)",
  );
  assert(personaBase.includes("参照:"), "persona base declares collection reference line");
  assert(
    personaBase.includes(markerContract),
    "persona base documents candidate marker format (#333)",
  );
  assert(
    personaBase.includes("build_persona_instruction"),
    "persona base exposes instruction builder (#339)",
  );

  const ken = readAgentSource("mogu/personas/ken.py");
  assert(ken.includes("build_persona_instruction"), "ken uses shared persona instruction builder");
  assert(
    ken.includes("居酒屋") && (ken.includes("コスパ") || ken.includes("ワイワイ")),
    "ken specializes in izakaya/casual/cost-performance",
  );
  assert(
    ken.includes("口調") || ken.includes("カジュアル"),
    "ken has an explicit casual tone",
  );
  assert(
    ken.includes("推さない") || ken.includes("フォーマル"),
    "ken avoids quiet/formal date venues",
  );
  assert(
    ken.includes("中目黒サク飲み"),
    "ken declares demo collection name",
  );

  const aoi = readAgentSource("mogu/personas/aoi.py");
  assert(aoi.includes("build_persona_instruction"), "aoi uses shared persona instruction builder");
  assert(
    aoi.includes("デート") && (aoi.includes("雰囲気") || aoi.includes("プロポーズ")),
    "aoi specializes in date/atmosphere/special occasions",
  );
  assert(
    aoi.includes("温かみ") || aoi.includes("落ち着い"),
    "aoi has a warm/calm tone",
  );
  assert(
    aoi.includes("推さない") || aoi.includes("ワイワイ"),
    "aoi avoids loud izakaya-style venues",
  );
  assert(
    aoi.includes("静かな二人時間"),
    "aoi declares demo collection name",
  );

  const maps = readAgentSource("mogu_maps/agent.py");
  assert(
    maps.includes("Never output thinking process"),
    "maps grounding forbids thinking process output",
  );

  const parser = readFileSync(
    join(process.cwd(), "src/lib/agent/reply-sanitizer.ts"),
    "utf8",
  );
  assert(parser.includes("stripLeakedThinkingText"), "sanitizer strips leaked thinking");
  assert(parser.includes("stripDelegationNarration"), "sanitizer strips delegation narration");
  assert(parser.includes("stripPersonaReferenceLines"), "sanitizer strips persona reference lines");
  assert(parser.includes("inferPersonaTasteEvidence"), "sanitizer infers persona taste evidence");
  assert(
    parser.includes("thinking\\s*process"),
    "sanitizer matches thinking process label",
  );

  const streamParser = readFileSync(
    join(process.cwd(), "src/lib/agent/stream-parser.ts"),
    "utf8",
  );
  assert(streamParser.includes("PERSONA_AUTHORS"), "parser skips persona author text");
  assert(
    streamParser.includes("drainJsonObjects"),
    "parser extracts JSON stream objects",
  );

  assert(
    orchestrator.includes("フォローアップ") ||
      orchestrator.includes("すり替えない"),
    "orchestrator keeps same place on follow-up (#264)",
  );

  for (const [label, source] of [
    ["orchestrator", orchestrator],
    ["persona_base", personaBase],
  ] as const) {
    assert(
      source.includes(markerContract),
      `${label} documents candidate marker format (#333)`,
    );
  }

  const sampleMarker =
    "[[候補 spot_id=22222222-2222-4222-8222-222222222303 place_id=ChIJN1t_tDeuEmsRUsoyG83frY4]]";
  assert(
    matchesCandidateMarkerLine(sampleMarker),
    "TS candidate marker pattern matches canonical sample line (#333)",
  );

  console.log("PASS: agent instructions (#251/#263/#269/#270/#264/#333/#334/#339)");
}

main();
