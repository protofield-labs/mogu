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

/** Session id does not exist on the orchestrator Reasoning Engine. */
export class AgentSessionNotFoundError extends Error {
  constructor() {
    super("Agent session not found");
    this.name = "AgentSessionNotFoundError";
  }
}

/** Authenticated user does not own the Vertex session. */
export class AgentSessionForbiddenError extends Error {
  constructor() {
    super("Agent session forbidden");
    this.name = "AgentSessionForbiddenError";
  }
}
