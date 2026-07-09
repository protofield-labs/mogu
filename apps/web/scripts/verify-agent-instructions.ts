/**
 * Agent instruction language / routing / no-leak guards (#251/#263/#269).
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

  const ken = readAgentSource("mogu/personas/ken.py");
  assertJapanesePersona(ken, "ken");
  assert(ken.includes("ユーザーに直接話しかけない"), "ken does not address the user directly");
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

  const aoi = readAgentSource("mogu/personas/aoi.py");
  assertJapanesePersona(aoi, "aoi");
  assert(aoi.includes("ユーザーに直接話しかけない"), "aoi does not address the user directly");
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

  console.log("PASS: agent instructions (#251/#263/#269)");
}

main();
