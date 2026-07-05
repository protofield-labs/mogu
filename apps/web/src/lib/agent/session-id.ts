/** Extract session id from `projects/.../sessions/{sessionId}`. */
export function parseSessionId(sessionResourceName: string): string {
  const sessionId = sessionResourceName.split("/").pop();
  if (!sessionId) {
    throw new Error("Invalid session resource name");
  }
  return sessionId;
}

/** Read Agent Engine env without server-only (for CI verify script). */
export function readAgentEngineConfigFromEnv(
  env: Record<string, string | undefined>,
): {
  orchestratorResourceName: string;
  mapsGroundingResourceName: string | null;
  location: string;
} | null {
  const orchestratorResourceName = env.AGENT_ENGINE_RESOURCE_NAME?.trim();
  const location =
    env.VERTEX_AI_LOCATION?.trim() ||
    env.GOOGLE_CLOUD_REGION?.trim() ||
    "asia-northeast1";

  if (!orchestratorResourceName) {
    return null;
  }

  return {
    orchestratorResourceName,
    mapsGroundingResourceName:
      env.MAPS_GROUNDING_ENGINE_RESOURCE_NAME?.trim() || null,
    location,
  };
}
