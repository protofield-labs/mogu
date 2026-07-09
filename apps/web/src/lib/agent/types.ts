import type { SpotDto } from "@/lib/spot/types";

/** OpenAPI Spot (subset used by agent UI). */
export type Spot = SpotDto;

/** OpenAPI Recommendation (#55 assertion card). */
export type Recommendation = {
  spot: Spot;
  assertion: string;
  evidence: string;
  alternatives: Spot[];
  savedByMe?: boolean;
};

/** OpenAPI AgentMessage (#44). Candidate cards for consult turns (#287). */
export type AgentMessage = {
  role: "agent";
  text: string;
  thinking?: string[];
  recommendation?: Recommendation;
  candidateSpots?: Spot[];
  quickReplies?: string[];
};

/** Tapped candidate card reference sent with a follow-up turn (#287). */
export type CandidateSpotRef = {
  spotId: string;
  placeId: string;
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
  candidateSpot?: CandidateSpotRef;
};

import type { CollectionConsultContext } from "./collection-context-message";

export type RecommendationContext = {
  placeId: string;
  spotId: string;
  assertion: string;
  evidence: string;
  placeName?: string | null;
};

export type CreateAgentSessionRequest = {
  recommendationContext?: RecommendationContext;
  collectionContext?: CollectionConsultContext;
};

export type CreateAgentSessionResponse = {
  sessionId: string;
};

/** Places display DTO (fetched at render time, guardrail 7). */
export type PlaceLocation = {
  lat: number;
  lng: number;
};

export type PlaceDTO = {
  placeId: string;
  name: string;
  address: string;
  photos: { url: string; authorAttributions: { name: string; uri: string }[] }[];
  location?: PlaceLocation;
  openNow?: boolean;
};
