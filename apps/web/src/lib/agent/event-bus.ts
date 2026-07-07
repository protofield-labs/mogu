import "server-only";

import type { AgentEventDelivery } from "./event-bus-core";
import {
  fanoutAgentEvent,
  resetAgentEventBusForTests,
  subscribeAgentEvents,
} from "./event-bus-core";
import type { AgentEvent } from "./types";
import {
  appendAgentSessionEvent,
  listAgentSessionEventsAfter,
  listBufferedAgentSessionEvents,
} from "@/lib/dal/agent-session-events";

export { AGENT_EVENT_BUFFER_LIMIT } from "./agent-event-replay";
export type { AgentEventDelivery } from "./event-bus-core";

/** Persist to Cloud SQL and fan out locally (#45, #66). */
export async function publishAgentEvent(
  userId: string,
  sessionId: string,
  event: AgentEvent,
): Promise<AgentEventDelivery> {
  const delivery = await appendAgentSessionEvent(userId, sessionId, event);
  fanoutAgentEvent(userId, sessionId, delivery);
  return delivery;
}

export async function listBufferedAgentEvents(
  userId: string,
  sessionId: string,
  afterEventId?: string,
): Promise<AgentEventDelivery[]> {
  return listBufferedAgentSessionEvents(userId, sessionId, afterEventId);
}

export async function pollAgentSessionEvents(
  userId: string,
  sessionId: string,
  afterEventId: string,
): Promise<AgentEventDelivery[]> {
  return listAgentSessionEventsAfter(userId, sessionId, afterEventId);
}

export { resetAgentEventBusForTests, subscribeAgentEvents };
