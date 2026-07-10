import "server-only";

import { isAgentAssertionTurn } from "./assertion-turn";
import { buildAgentRecommendation } from "./build-recommendation";
import {
  buildAgentCandidateSpots,
  getCandidatePinContext,
} from "./candidate-spots";
import {
  CANDIDATE_RESOLUTION_FAILED_TEXT,
  extractCandidateSpotMarkers,
  mergeCandidateSpotMarkers,
} from "./candidate-spot-markers";
import { publishAgentEvent } from "./event-bus";
import {
  AgentSessionError,
  AgentSessionNotFoundError,
} from "./errors";
import {
  buildCandidateFollowUpUserMessage,
  buildFollowUpUserMessage,
  isSamePlaceFollowUp,
  type CandidatePinContext,
} from "./followup-context";
import {
  applyStreamEvent,
  buildAgentUserMessage,
  createDoneEvent,
  drainJsonObjects,
  extractThinkingEvent,
  inferPersonaTasteEvidence,
  inferPersonaKey,
  resolveAgentReplyText,
  type StreamEvent,
} from "./stream-parser";
import {
  buildRecommendationContextMessage,
  recommendationToContext,
} from "./recommendation-context-message";
import { buildCollectionContextMessage } from "./collection-context-message";
import { loadPersonaCollectionBlocks } from "./persona-collection-context";
import {
  buildPersonaCollectionContextMessage,
  hasPersonaCollectionSpots,
} from "./persona-collection-message";
import type {
  AgentEvent,
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
  getAccessToken,
  requireAgentEngineConfig,
  vertexApiBase,
} from "./vertex-client";

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

function drainStreamBuffer(
  buffer: string,
  onEvent: (event: StreamEvent) => void,
  textParts: string[],
  personaTextParts: string[],
): string {
  const drained = drainJsonObjects(buffer);
  for (const event of drained.events) {
    onEvent(event);
    applyStreamEvent(event, textParts, personaTextParts);
  }
  return drained.remainder;
}

type StreamQueryResult = {
  /** User-facing reply after orchestrator/persona resolution. */
  text: string;
  /** Raw orchestrator text — may hold markers the resolver dropped (#313). */
  orchestratorText: string;
  /** Raw persona text — may hold markers the orchestrator rewrote away (#313). */
  personaText: string;
};

async function consumeStreamQueryResponse(
  response: Response,
  onEvent: (event: StreamEvent) => void,
): Promise<StreamQueryResult> {
  if (!response.body) {
    throw new AgentSessionError("Vertex AI streamQuery returned empty body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const textParts: string[] = [];
  const personaTextParts: string[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer = drainStreamBuffer(
      buffer + decoder.decode(value, { stream: true }),
      onEvent,
      textParts,
      personaTextParts,
    );
  }

  buffer = drainStreamBuffer(
    buffer + decoder.decode(),
    onEvent,
    textParts,
    personaTextParts,
  );

  const orchestratorText = textParts.join("");
  const personaText = personaTextParts.join("");
  const text = resolveAgentReplyText(orchestratorText, personaText);
  if (!text) {
    throw new AgentSessionError("Vertex AI agent returned empty response");
  }

  return { text, orchestratorText, personaText };
}

/**
 * Send a user turn to the orchestrator via Vertex :streamQuery (#44).
 * Publishes thinking/done AgentEvents for SSE subscribers (#45).
 */
export async function sendAgentMessage(
  input: SendAgentMessageInput,
): Promise<AgentMessage> {
  await assertAgentSessionOwnership(input.userId, input.sessionId);

  const config = requireAgentEngineConfig();
  const token = await getAccessToken();
  const url = `${vertexApiBase(config.location)}/${config.orchestratorResourceName}:streamQuery`;

  // Re-seed the active recommendation so follow-ups stay on the same place (#264).
  let activeRecommendation = null as Awaited<
    ReturnType<typeof getLatestRecommendationForSession>
  >;
  try {
    activeRecommendation = await getLatestRecommendationForSession(
      input.userId,
      input.sessionId,
    );
  } catch {
    activeRecommendation = null;
  }

  // Tapped candidate cards hard-pin the follow-up to the selected spot (#287).
  let candidatePin: CandidatePinContext | null = null;
  if (input.candidateSpot) {
    try {
      candidatePin = await getCandidatePinContext(
        input.userId,
        input.candidateSpot,
      );
    } catch {
      candidatePin = null;
    }
  }

  const userMessage = buildAgentUserMessage(input.text, input.chips);
  // Soft-pin LLM context on same-place follow-ups only; new searches stay free (#264).
  // Candidate taps must never fall back to the #264 pin — a stale tap would
  // otherwise explain the previous recommendation instead of the tapped card.
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

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      class_method: "async_stream_query",
      input: {
        user_id: input.userId,
        session_id: input.sessionId,
        message,
      },
    }),
  });

  if (!response.ok) {
    const raw = await response.text();
    if (response.status === 404) {
      throw new AgentSessionNotFoundError();
    }
    throw new AgentSessionError(
      raw.trim() || `Vertex AI streamQuery failed (${response.status})`,
    );
  }

  const thinkingMessages: string[] = [];
  const seenThinking = new Set<string>();
  let publishChain = Promise.resolve();
  const publishEvents = !input.skipAgentEvents;

  const publishEventBestEffort = async (event: AgentEvent) => {
    if (!publishEvents) {
      return;
    }
    try {
      await publishAgentEvent(input.userId, input.sessionId, event);
    } catch {
      // SSE persistence is best-effort; the Vertex turn already succeeded.
    }
  };

  const publishThinking = (event: AgentEvent) => {
    if (!publishEvents) {
      return;
    }
    if (seenThinking.has(event.message)) {
      return;
    }
    seenThinking.add(event.message);
    thinkingMessages.push(event.message);
    publishChain = publishChain.then(() => publishEventBestEffort(event));
  };

  let streamResult: StreamQueryResult;
  try {
    streamResult = await consumeStreamQueryResponse(response, (streamEvent) => {
      const thinking = extractThinkingEvent(streamEvent);
      if (thinking) {
        publishThinking(thinking);
      }
    });
  } finally {
    if (publishEvents) {
      await publishChain;
      await publishEventBestEffort(createDoneEvent());
    }
  }

  // Candidate markers become thumbnail cards; the visible text drops them (#287).
  const { text, markers: resolvedTextMarkers } = extractCandidateSpotMarkers(
    streamResult.text,
  );
  // The orchestrator often rewrites persona proposals in its own words and
  // drops their `[[候補 …]]` lines. Mine markers from every raw author text so
  // persona-only markers still become cards; the bubble keeps the resolved
  // reply (#313).
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
  if (candidateMarkers.length > 0) {
    // Per-source counts make "persona-only markers" turns diagnosable (#313).
    logger.info("agent candidate markers extracted", {
      sessionId: input.sessionId,
      resolvedTextMarkerCount: resolvedTextMarkers.length,
      orchestratorMarkerCount: orchestratorMarkers.length,
      personaMarkerCount: personaMarkers.length,
      mergedMarkerCount: candidateMarkers.length,
    });
  }

  const personaKey = inferPersonaKey(text, thinkingMessages);
  const personaTasteHint = inferPersonaTasteEvidence(text, thinkingMessages);
  const anchorSpotId =
    candidatePin?.spotId ??
    (pinSamePlace ? activeRecommendation?.spot.id : undefined);
  const hasCandidateMarkers = candidateMarkers.length > 0;
  // Markers in the resolved reply always mean candidate cards (#287). Markers
  // mined only from raw author texts are weaker: assertive final replies still
  // use the DB-backed recommendation flow so hallucinated shop names in prose
  // are replaced (#313), but non-assertive replies keep persona/orchestrator
  // markers as cards.
  const useCandidateCards =
    resolvedTextMarkers.length > 0 ||
    (hasCandidateMarkers && !isAgentAssertionTurn(text));
  const recommendation =
    !useCandidateCards && isAgentAssertionTurn(text)
      ? await buildAgentRecommendation(
          input.userId,
          personaTasteHint,
          personaKey,
          anchorSpotId ? { anchorSpotId } : undefined,
        )
      : null;

  let candidateSpots: AgentMessage["candidateSpots"];
  let displayText = text;
  if (!recommendation && useCandidateCards && hasCandidateMarkers) {
    try {
      const spots = await buildAgentCandidateSpots(
        input.userId,
        candidateMarkers,
      );
      candidateSpots = spots.length > 0 ? spots : undefined;
      if (!candidateSpots) {
        displayText = CANDIDATE_RESOLUTION_FAILED_TEXT;
      }
      if (spots.length < candidateMarkers.length) {
        // RLS-invisible spots and spot_id/place_id mismatches drop silently
        // in buildAgentCandidateSpots — surface the gap for triage (#313).
        logger.warn("agent candidate markers dropped during DB resolution", {
          sessionId: input.sessionId,
          markerCount: candidateMarkers.length,
          resolvedCount: spots.length,
        });
      }
    } catch (error) {
      displayText = CANDIDATE_RESOLUTION_FAILED_TEXT;
      // Candidate cards are best-effort; the text reply already succeeded.
      logger.warn(
        "agent candidate spot resolution failed",
        {
          sessionId: input.sessionId,
          markerCount: candidateMarkers.length,
        },
        error,
      );
    }
  }

  if (recommendation) {
    displayText = recommendation.assertion;
  }

  const agentMessage: AgentMessage = {
    role: "agent",
    text: displayText,
    ...(thinkingMessages.length > 0 ? { thinking: thinkingMessages } : {}),
    ...(recommendation ? { recommendation } : {}),
    ...(candidateSpots ? { candidateSpots } : {}),
    ...(personaKey ? { personaKey } : {}),
  };

  if (!input.skipConsultationPersist) {
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
