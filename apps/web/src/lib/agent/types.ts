/** OpenAPI AgentMessage (#44). */
export type AgentMessage = {
  role: "agent";
  text: string;
  thinking?: string[];
  recommendation?: unknown;
  quickReplies?: string[];
};

export type AgentMessageRequest = {
  text: string;
  chips?: string[];
};
