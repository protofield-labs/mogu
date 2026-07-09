/**
 * Agent instruction language / no-thinking guards (#251).
 * Run via: pnpm exec tsx scripts/verify-agent-instructions.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { assert } from "./test-helpers/assert";

const agentsRoot = join(process.cwd(), "..", "..", "agents");

function readAgentSource(relativePath: string): string {
  return readFileSync(join(agentsRoot, relativePath), "utf8");
}

function assertJapaneseAndNoThinking(source: string, label: string): void {
  assert(
    source.includes("Always reply") && source.includes("Japanese"),
    `${label} requires Japanese replies`,
  );
  assert(
    source.includes("Never output thinking process") ||
      source.includes("Never output thinking process, chain-of-thought"),
    `${label} forbids thinking process output`,
  );
}

function main() {
  const orchestrator = readAgentSource("mogu/agent.py");
  assertJapaneseAndNoThinking(orchestrator, "orchestrator");
  assert(
    orchestrator.includes("Do not expose internal tool or persona dialogue"),
    "orchestrator hides persona dialogue",
  );

  assertJapaneseAndNoThinking(readAgentSource("mogu/personas/ken.py"), "ken");
  assertJapaneseAndNoThinking(readAgentSource("mogu/personas/aoi.py"), "aoi");

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
  assert(
    parser.includes("thinking\\s*process"),
    "parser matches thinking process label",
  );

  console.log("PASS: agent instructions (#251)");
}

main();
