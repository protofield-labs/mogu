/** Agent Engine is not deployed or env is missing (#43). */
export class AgentEngineNotConfiguredError extends Error {
  constructor() {
    super("Agent Engine is not configured");
    this.name = "AgentEngineNotConfiguredError";
  }
}

/** Vertex AI Session API returned an unexpected response. */
export class AgentSessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentSessionError";
  }
}
