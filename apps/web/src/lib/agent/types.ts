/** OpenAPI Spot (subset used by agent UI). */
export type Spot = {
  id: string;
  placeId: string;
  addedBy: string;
  collectionId: string;
  photoUrls: string[];
  comment: string;
  rating: "again" | "either" | "no";
  structuredTags: Record<string, unknown>;
  freeTags: string[];
  savedCount: number;
  originUserId: string | null;
  createdAt: string;
};

/** OpenAPI Recommendation (#55 assertion card). */
export type Recommendation = {
  spot: Spot;
  assertion: string;
  evidence: string;
  alternatives: Spot[];
};

/** OpenAPI AgentMessage (#44). */
export type AgentMessage = {
  role: "agent";
  text: string;
  thinking?: string[];
  recommendation?: Recommendation;
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

export type CreateAgentSessionResponse = {
  sessionId: string;
};

/** Places display DTO (fetched at render time, guardrail 7). */
export type PlaceDTO = {
  placeId: string;
  name: string;
  address: string;
  openNow?: boolean;
};
