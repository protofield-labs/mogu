/**
 * Persona config centralization verification (#334).
 * Run via: pnpm exec tsx scripts/verify-persona-config.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  AGENT_PERSONAS,
  AGENT_PERSONA_BY_KEY,
  buildPersonaCollectionHintsRecord,
  buildPersonaThinkingRecord,
  isAgentDemoMode,
  personaCollectionNames,
} from "../src/lib/agent/persona-config";
import { assert } from "./test-helpers/assert";

const agentsRoot = join(process.cwd(), "..", "..", "agents");

function readAgentSource(relativePath: string): string {
  return readFileSync(join(agentsRoot, relativePath), "utf8");
}

function readWebSource(relativePath: string): string {
  return readFileSync(join(process.cwd(), "src", relativePath), "utf8");
}

assert(AGENT_PERSONAS.length === 2, "agent personas include ken and aoi");
assert(
  AGENT_PERSONAS.every((persona) => persona.collectionName.length > 0),
  "each persona has collection name",
);
assert(
  AGENT_PERSONAS.every((persona) => persona.ownerId.startsWith("demo-")),
  "persona owner ids are demo uids",
);

const thinking = buildPersonaThinkingRecord();
const hints = buildPersonaCollectionHintsRecord();
for (const persona of AGENT_PERSONAS) {
  assert(
    thinking[persona.key] === persona.thinkingLabel,
    `${persona.key} thinking label derived`,
  );
  assert(
    hints[persona.key]?.collection === persona.collectionName,
    `${persona.key} collection hint derived`,
  );
  assert(
    hints[persona.key]?.demoUid === persona.ownerId,
    `${persona.key} demo uid derived`,
  );
}

const ken = readAgentSource("mogu/personas/ken.py");
const aoi = readAgentSource("mogu/personas/aoi.py");
assert(
  ken.includes(AGENT_PERSONA_BY_KEY.ken.collectionName),
  "ken.py matches persona-config collection name",
);
assert(
  aoi.includes(AGENT_PERSONA_BY_KEY.aoi.collectionName),
  "aoi.py matches persona-config collection name",
);

const streamParser = readWebSource("lib/agent/stream-parser.ts");
assert(
  streamParser.includes("persona-config"),
  "stream-parser derives labels from persona-config",
);

const personaIntro = readWebSource("lib/agent/persona-intro.ts");
assert(
  personaIntro.includes("AGENT_PERSONAS"),
  "persona intro derives profiles from persona-config",
);

const personaContext = readWebSource("lib/agent/persona-collection-context.ts");
assert(
  personaContext.includes("AGENT_PERSONAS"),
  "persona collection context uses persona-config",
);
assert(
  personaContext.includes("withDemoPersonaViewerFallback"),
  "persona collection context uses demo fallback helper",
);

const candidateSpots = readWebSource("lib/agent/candidate-spots.ts");
assert(
  candidateSpots.includes("withDemoPersonaViewerFallback"),
  "candidate spots use demo fallback helper",
);

const messageClient = readWebSource("lib/agent/message-client.ts");
assert(
  messageClient.includes("isAgentDemoMode"),
  "message client gates persona prefetch with demo mode flag",
);

const demoFallback = readWebSource("lib/agent/demo-persona-fallback.ts");
assert(
  demoFallback.includes("isAgentDemoMode"),
  "demo fallback helper respects AGENT_DEMO_MODE",
);

const seed = readFileSync(
  join(process.cwd(), "src/lib/seed/run-demo-seed.ts"),
  "utf8",
);
assert(
  seed.includes("AGENT_PERSONA_BY_KEY"),
  "demo seed uses persona-config collection names",
);

assert(
  personaCollectionNames().includes(AGENT_PERSONA_BY_KEY.ken.collectionName),
  "persona collection names include ken collection",
);

assert(isAgentDemoMode(), "AGENT_DEMO_MODE defaults to enabled");

console.log("PASS: persona config (#334)");
