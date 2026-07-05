import "server-only";

import { readAgentEngineConfigFromEnv } from "./session-id";

/** Vertex AI Agent Engine runtime config (#43). */
export type AgentEngineConfig = {
  /** projects/{project}/locations/{location}/reasoningEngines/{id} */
  orchestratorResourceName: string;
  mapsGroundingResourceName: string | null;
  location: string;
};

export function getAgentEngineConfig(): AgentEngineConfig | null {
  return readAgentEngineConfigFromEnv(process.env);
}

export function isAgentEngineConfigured(): boolean {
  return getAgentEngineConfig() !== null;
}
