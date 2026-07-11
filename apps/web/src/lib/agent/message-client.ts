import "server-only";

import { executeAgentStreamQuery } from "./agent-stream-query";
import { getCandidatePinContext } from "./candidate-spots";
import {
  buildCandidateFollowUpUserMessage,
  buildFollowUpUserMessage,
  isSamePlaceFollowUp,
  type CandidatePinContext,
} from "./followup-context";
import { resolveAgentTurnMessage } from "./resolve-agent-turn";
import { buildAgentUserMessage } from "./stream-parser";
import { buildCollectionContextMessage } from "./collection-context-message";
import { loadPersonaCollectionBlocks } from "./persona-collection-context";
import { isAgentDemoMode } from "./persona-config";
import {
  buildPersonaCollectionContextMessage,
  hasPersonaCollectionSpots,
} from "./persona-collection-message";
import type {
  AgentMessage,
  CandidateSpotRef,
  RecommendationContext,
} from "./types";
import type { CollectionConsultContext } from "./collection-context-message";
import { assertAgentSessionOwnership } from "./session-client";
import {
  appendAgentConsultationTurn,
  getLatestRecommendationForSession,
} from "@/lib/dal/agent-consultations";
import { logger } from "@/lib/logger";
import { fetchPlaceDetails } from "@/lib/places/google-places-client";
import {
  buildRecommendationContextMessage,
  recommendationToContext,
} from "./recommendation-context-message";

type SendAgentMessageInput = {
  userId: string;
  sessionId: string;
  text: string;
  chips?: string[];
  /** Tapped candidate card — pins the follow-up to that spot (#287). */
  candidateSpot?: CandidateSpotRef;
  skipConsultationPersist?: boolean;
  skipAgentEvents?: boolean;
};

async function loadActiveRecommendation(
  userId: string,
  sessionId: string,
): Promise<Awaited<ReturnType<typeof getLatestRecommendationForSession>>> {
  try {
    return await getLatestRecommendationForSession(userId, sessionId);
  } catch (error) {
    logger.warn(
      "failed to load active recommendation for follow-up pin",
      { userId, sessionId },
      error,
    );
    return null;
  }
}

async function loadCandidatePin(
  userId: string,
  candidateSpot: CandidateSpotRef,
): Promise<CandidatePinContext | null> {
  try {
    return await getCandidatePinContext(userId, candidateSpot);
  } catch (error) {
    logger.warn(
      "failed to load candidate pin context",
      { userId, spotId: candidateSpot.spotId },
      error,
    );
    return null;
  }
}

async function persistAgentTurn(
  input: SendAgentMessageInput,
  agentMessage: AgentMessage,
): Promise<void> {
  if (input.skipConsultationPersist) {
    return;
  }
  try {
    await appendAgentConsultationTurn(
      input.userId,
      input.sessionId,
      input.text,
      input.chips,
      agentMessage,
    );
  } catch {
    // History persistence is best-effort; the Vertex turn already succeeded.
  }
}

/**
 * Send a user turn to the orchestrator via Vertex :streamQuery (#44).
 * Publishes thinking/done AgentEvents for SSE subscribers (#45).
 */
export async function sendAgentMessage(
  input: SendAgentMessageInput,
): Promise<AgentMessage> {
  await assertAgentSessionOwnership(input.userId, input.sessionId);

  const activeRecommendation = await loadActiveRecommendation(
    input.userId,
    input.sessionId,
  );

  const candidatePin = input.candidateSpot
    ? await loadCandidatePin(input.userId, input.candidateSpot)
    : null;

  const userMessage = buildAgentUserMessage(input.text, input.chips);
  const pinSamePlace =
    !input.candidateSpot &&
    Boolean(activeRecommendation) &&
    isSamePlaceFollowUp(input.text);
  const message = candidatePin
    ? buildCandidateFollowUpUserMessage(userMessage, candidatePin)
    : buildFollowUpUserMessage(
        userMessage,
        pinSamePlace && activeRecommendation
          ? recommendationToContext(activeRecommendation)
          : null,
      );

  const { streamResult, thinkingMessages } = await executeAgentStreamQuery({
    userId: input.userId,
    sessionId: input.sessionId,
    message,
    skipAgentEvents: input.skipAgentEvents,
  });

  const agentMessage = await resolveAgentTurnMessage({
    userId: input.userId,
    sessionId: input.sessionId,
    streamResult,
    thinkingMessages,
    candidatePin,
    pinSamePlace,
    activeRecommendationSpotId: activeRecommendation?.spot.id,
  });

  await persistAgentTurn(input, agentMessage);

  return agentMessage;
}

/** Seed Vertex session state with home recommendation context (#204). Best-effort. */
export async function seedAgentRecommendationContext(input: {
  userId: string;
  sessionId: string;
  context: RecommendationContext;
}): Promise<void> {
  try {
    let context = input.context;
    if (!context.placeName?.trim()) {
      const place = await fetchPlaceDetails(context.placeId);
      if (place?.name?.trim()) {
        context = { ...context, placeName: place.name.trim() };
      }
    }
    await sendAgentMessage({
      userId: input.userId,
      sessionId: input.sessionId,
      text: buildRecommendationContextMessage(context),
      skipConsultationPersist: true,
      skipAgentEvents: true,
    });
  } catch {
    // Context seeding must not block chat start.
  }
}

/** Seed Vertex session state with collection consult context (#239). Best-effort. */
export async function seedAgentCollectionContext(input: {
  userId: string;
  sessionId: string;
  context: CollectionConsultContext;
}): Promise<void> {
  try {
    await sendAgentMessage({
      userId: input.userId,
      sessionId: input.sessionId,
      text: buildCollectionContextMessage(input.context),
      skipConsultationPersist: true,
      skipAgentEvents: true,
    });
  } catch {
    // Context seeding must not block chat start.
  }
}

/**
 * Seed Ken/Aoi demo collection spots from Cloud SQL into the session (#264).
 * Bridge until ADK FunctionTools can query collections directly. Best-effort.
 */
export async function seedAgentPersonaCollectionContext(input: {
  userId: string;
  sessionId: string;
}): Promise<void> {
  if (!isAgentDemoMode()) {
    return;
  }
  try {
    const blocks = await loadPersonaCollectionBlocks(input.userId);
    if (!hasPersonaCollectionSpots(blocks)) {
      return;
    }
    await sendAgentMessage({
      userId: input.userId,
      sessionId: input.sessionId,
      text: buildPersonaCollectionContextMessage(blocks),
      skipConsultationPersist: true,
      skipAgentEvents: true,
    });
  } catch {
    // Persona collection seeding must not block chat start.
  }
}
