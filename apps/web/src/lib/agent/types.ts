/** OpenAPI AgentMessage (#44). */
export type AgentMessage = {
  role: "agent";
  text: string;
  thinking?: string[];
  recommendation?: unknown;
  quickReplies?: string[];
};

/** OpenAPI AgentEvent (#45). */
export type AgentEvent = {
  type: "thinking" | "done";
  message: string;
  timestamp: string;
};

export type AgentMessageRequest = {
  text: string;
  chips?: string[];
};
