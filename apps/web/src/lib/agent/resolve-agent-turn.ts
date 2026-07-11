import "server-only";

import { isAgentAssertionTurn } from "./assertion-turn";
import { buildAgentRecommendation } from "./build-recommendation";
import { buildAgentCandidateSpots } from "./candidate-spots";
import {
  CANDIDATE_ONLY_REPLY_TEXT,
  CANDIDATE_RESOLUTION_FAILED_TEXT,
  extractCandidateSpotMarkers,
  mergeCandidateSpotMarkers,
  RECOMMENDATION_RESOLUTION_FAILED_TEXT,
  type CandidateSpotMarker,
} from "./candidate-spot-markers";
import type { CandidatePinContext } from "./followup-context";
import {
  inferPersonaKey,
  inferPersonaTasteEvidence,
} from "./reply-sanitizer";
import type { StreamQueryResult } from "./agent-stream-query";
import type { AgentMessage } from "./types";
import type { PersonaKey } from "./reply-sanitizer";
import { logger } from "@/lib/logger";

export type CandidateMarkerBundle = {
  text: string;
  resolvedTextMarkers: CandidateSpotMarker[];
  orchestratorMarkers: CandidateSpotMarker[];
  personaMarkers: CandidateSpotMarker[];
  candidateMarkers: CandidateSpotMarker[];
};

export type AgentTurnRoute = {
  text: string;
  personaKey: PersonaKey | null;
  personaTasteHint: string | null;
  useCandidateCards: boolean;
  hasCandidateMarkers: boolean;
  needsAssertionRecommendation: boolean;
  anchorSpotId: string | undefined;
};

/** Extract and merge candidate markers from all stream author texts (#313). */
export function extractCandidateMarkerBundle(
  streamResult: StreamQueryResult,
): CandidateMarkerBundle {
  const { text, markers: resolvedTextMarkers } = extractCandidateSpotMarkers(
    streamResult.text,
  );
  const personaMarkers = extractCandidateSpotMarkers(
    streamResult.personaText,
  ).markers;
  const orchestratorMarkers = extractCandidateSpotMarkers(
    streamResult.orchestratorText,
  ).markers;
  const candidateMarkers = mergeCandidateSpotMarkers(
    resolvedTextMarkers,
    orchestratorMarkers,
    personaMarkers,
  );

  return {
    text,
    resolvedTextMarkers,
    orchestratorMarkers,
    personaMarkers,
    candidateMarkers,
  };
}

/** Pure routing: candidate cards vs single recommendation (#287 / #313 / #317). */
export function resolveAgentTurnRoute(input: {
  markerBundle: CandidateMarkerBundle;
  thinkingMessages: string[];
  candidatePin: CandidatePinContext | null;
  pinSamePlace: boolean;
  activeRecommendationSpotId?: string;
}): AgentTurnRoute {
  const {
    text,
    resolvedTextMarkers,
    orchestratorMarkers,
    personaMarkers,
    candidateMarkers,
  } = input.markerBundle;

  const personaKey = inferPersonaKey(text, input.thinkingMessages);
  const personaTasteHint = inferPersonaTasteEvidence(
    text,
    input.thinkingMessages,
  );
  const anchorSpotId =
    input.candidatePin?.spotId ??
    (input.pinSamePlace ? input.activeRecommendationSpotId : undefined);
  const hasCandidateMarkers = candidateMarkers.length > 0;
  const hasMinedOnlyMarkers =
    resolvedTextMarkers.length === 0 &&
    hasCandidateMarkers &&
    (personaMarkers.length > 0 || orchestratorMarkers.length > 0);
  const useCandidateCards =
    resolvedTextMarkers.length > 0 ||
    hasMinedOnlyMarkers ||
    (hasCandidateMarkers && !isAgentAssertionTurn(text));
  const needsAssertionRecommendation =
    !useCandidateCards && isAgentAssertionTurn(text);

  return {
    text,
    personaKey,
    personaTasteHint,
    useCandidateCards,
    hasCandidateMarkers,
    needsAssertionRecommendation,
    anchorSpotId,
  };
}

export function resolveAgentDisplayText(input: {
  text: string;
  route: AgentTurnRoute;
  recommendation: AgentMessage["recommendation"] | null;
  candidateSpots: AgentMessage["candidateSpots"] | undefined;
}): string {
  const { text, route, recommendation, candidateSpots } = input;

  if (recommendation) {
    return recommendation.assertion;
  }
  if (route.useCandidateCards && route.hasCandidateMarkers) {
    if (candidateSpots) {
      return CANDIDATE_ONLY_REPLY_TEXT;
    }
    return CANDIDATE_RESOLUTION_FAILED_TEXT;
  }
  if (route.needsAssertionRecommendation) {
    return RECOMMENDATION_RESOLUTION_FAILED_TEXT;
  }
  return text;
}

export type ResolveAgentTurnMessageInput = {
  userId: string;
  sessionId: string;
  streamResult: StreamQueryResult;
  thinkingMessages: string[];
  candidatePin: CandidatePinContext | null;
  pinSamePlace: boolean;
  activeRecommendationSpotId?: string;
};

/** Resolve stream output into a display-ready AgentMessage (#335). */
export async function resolveAgentTurnMessage(
  input: ResolveAgentTurnMessageInput,
): Promise<AgentMessage> {
  const markerBundle = extractCandidateMarkerBundle(input.streamResult);
  const route = resolveAgentTurnRoute({
    markerBundle,
    thinkingMessages: input.thinkingMessages,
    candidatePin: input.candidatePin,
    pinSamePlace: input.pinSamePlace,
    activeRecommendationSpotId: input.activeRecommendationSpotId,
  });

  if (markerBundle.candidateMarkers.length > 0) {
    logger.info("agent candidate markers extracted", {
      sessionId: input.sessionId,
      resolvedTextMarkerCount: markerBundle.resolvedTextMarkers.length,
      orchestratorMarkerCount: markerBundle.orchestratorMarkers.length,
      personaMarkerCount: markerBundle.personaMarkers.length,
      mergedMarkerCount: markerBundle.candidateMarkers.length,
    });
  }

  const recommendation =
    route.needsAssertionRecommendation
      ? await buildAgentRecommendation(
          input.userId,
          route.personaTasteHint,
          route.personaKey,
          route.anchorSpotId ? { anchorSpotId: route.anchorSpotId } : undefined,
        )
      : null;

  let candidateSpots: AgentMessage["candidateSpots"];
  if (!recommendation && route.useCandidateCards && route.hasCandidateMarkers) {
    try {
      const spots = await buildAgentCandidateSpots(
        input.userId,
        markerBundle.candidateMarkers,
      );
      candidateSpots = spots.length > 0 ? spots : undefined;
      if (spots.length < markerBundle.candidateMarkers.length) {
        logger.warn("agent candidate markers dropped during DB resolution", {
          sessionId: input.sessionId,
          markerCount: markerBundle.candidateMarkers.length,
          resolvedCount: spots.length,
        });
      }
    } catch (error) {
      logger.warn(
        "agent candidate spot resolution failed",
        {
          sessionId: input.sessionId,
          markerCount: markerBundle.candidateMarkers.length,
        },
        error,
      );
    }
  }

  const displayText = resolveAgentDisplayText({
    text: route.text,
    route,
    recommendation,
    candidateSpots,
  });

  return {
    role: "agent",
    text: displayText,
    ...(input.thinkingMessages.length > 0
      ? { thinking: input.thinkingMessages }
      : {}),
    ...(recommendation ? { recommendation } : {}),
    ...(candidateSpots ? { candidateSpots } : {}),
    ...(route.personaKey ? { personaKey: route.personaKey } : {}),
  };
}
