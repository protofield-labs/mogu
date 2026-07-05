/**
 * Agent Engine config verification (#43 Definition of Done).
 * Run via: pnpm exec tsx scripts/verify-agent-config.ts
 */
import {
  parseSessionId,
  readAgentEngineConfigFromEnv,
} from "../src/lib/agent/session-id";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function main() {
  assert(
    readAgentEngineConfigFromEnv({}) === null,
    "expected null when env empty",
  );

  const config = readAgentEngineConfigFromEnv({
    AGENT_ENGINE_RESOURCE_NAME:
      "projects/demo/locations/asia-northeast1/reasoningEngines/orchestrator",
    MAPS_GROUNDING_ENGINE_RESOURCE_NAME:
      "projects/demo/locations/asia-northeast1/reasoningEngines/maps",
    VERTEX_AI_LOCATION: "asia-northeast1",
  });
  assert(config !== null, "expected config when env set");
  if (!config) {
    throw new Error("unreachable");
  }
  assert(
    config.orchestratorResourceName.includes("reasoningEngines/"),
    "orchestrator resource name shape",
  );
  assert(
    config.mapsGroundingResourceName?.includes("reasoningEngines/") === true,
    "maps resource name shape",
  );
  assert(config.location === "asia-northeast1", "location from env");

  assert(
    parseSessionId(
      "projects/p/locations/asia-northeast1/reasoningEngines/e/sessions/s1",
    ) === "s1",
    "parseSessionId",
  );

  console.log("PASS: agent engine config helpers");
}

main();
