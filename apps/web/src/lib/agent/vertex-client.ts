import "server-only";

import { GoogleAuth } from "google-auth-library";

import { getAgentEngineConfig, type AgentEngineConfig } from "./config";
import { AgentEngineNotConfiguredError, AgentSessionError } from "./errors";

const auth = new GoogleAuth({
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});

export function requireAgentEngineConfig(): AgentEngineConfig {
  const config = getAgentEngineConfig();
  if (!config) {
    throw new AgentEngineNotConfiguredError();
  }
  return config;
}

export function vertexApiBase(location: string): string {
  return `https://${location}-aiplatform.googleapis.com/v1`;
}

export async function getAuthorizedClient() {
  return auth.getClient();
}

export async function getAccessToken(): Promise<string> {
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  if (!token.token) {
    throw new AgentSessionError("Failed to obtain Google Cloud access token");
  }
  return token.token;
}
