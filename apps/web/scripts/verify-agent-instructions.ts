/**
 * Agent instruction language / no-thinking / no-delegation-leak guards (#251/#263).
 * Run via: pnpm exec tsx scripts/verify-agent-instructions.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

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

  assertJapanesePersona(readAgentSource("mogu/personas/ken.py"), "ken");
  assertJapanesePersona(readAgentSource("mogu/personas/aoi.py"), "aoi");
  assert(
    readAgentSource("mogu/personas/ken.py").includes("ユーザーに直接話しかけない"),
    "ken does not address the user directly",
  );
  assert(
    readAgentSource("mogu/personas/aoi.py").includes("ユーザーに直接話しかけない"),
    "aoi does not address the user directly",
  );

  const maps = readAgentSource("mogu_maps/agent.py");
  assert(
    maps.includes("Never output thinking process"),
    "maps grounding forbids thinking process output",
  );

  const parser = readFileSync(
    join(process.cwd(), "src/lib/agent/stream-parser.ts"),
    "utf8",
  );
  assert(parser.includes("stripLeakedThinkingText"), "parser strips leaked thinking");
  assert(parser.includes("stripDelegationNarration"), "parser strips delegation narration");
  assert(parser.includes("PERSONA_AUTHORS"), "parser skips persona author text");
  assert(
    parser.includes("thinking\\s*process"),
    "parser matches thinking process label",
  );

  console.log("PASS: agent instructions (#251/#263)");
}

main();
