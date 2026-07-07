import "server-only";

import type { AgentEventDelivery } from "@/lib/agent/event-bus-core";
import {
  AGENT_EVENT_BUFFER_LIMIT,
  filterEventsForReplay,
} from "@/lib/agent/agent-event-replay";
import type { AgentEvent } from "@/lib/agent/types";
import { withAuthRls } from "@/lib/auth/with-auth-rls";

function toDelivery(row: {
  id: bigint;
  eventType: string;
  message: string;
  eventTimestamp: string;
}): AgentEventDelivery {
  return {
    id: row.id.toString(),
    event: {
      type: row.eventType as AgentEvent["type"],
      message: row.message,
      timestamp: row.eventTimestamp,
    },
  };
}

export async function appendAgentSessionEvent(
  uid: string,
  vertexSessionId: string,
  event: AgentEvent,
): Promise<AgentEventDelivery> {
  return withAuthRls(uid, async (tx) => {
    const row = await tx.agentSessionEvent.create({
      data: {
        userId: uid,
        vertexSessionId,
        eventType: event.type,
        message: event.message,
        eventTimestamp: event.timestamp,
      },
      select: {
        id: true,
        eventType: true,
        message: true,
        eventTimestamp: true,
      },
    });
    return toDelivery(row);
  });
}

async function listRecentAgentSessionEvents(
  uid: string,
  vertexSessionId: string,
): Promise<AgentEventDelivery[]> {
  return withAuthRls(uid, async (tx) => {
    const rows = await tx.agentSessionEvent.findMany({
      where: { userId: uid, vertexSessionId },
      orderBy: { id: "desc" },
      take: AGENT_EVENT_BUFFER_LIMIT,
      select: {
        id: true,
        eventType: true,
        message: true,
        eventTimestamp: true,
      },
    });
    return rows.reverse().map(toDelivery);
  });
}

export async function listBufferedAgentSessionEvents(
  uid: string,
  vertexSessionId: string,
  afterEventId?: string,
): Promise<AgentEventDelivery[]> {
  const recent = await listRecentAgentSessionEvents(uid, vertexSessionId);
  return filterEventsForReplay(recent, afterEventId);
}

export async function listAgentSessionEventsAfter(
  uid: string,
  vertexSessionId: string,
  afterEventId: string,
): Promise<AgentEventDelivery[]> {
  let after: bigint;
  try {
    after = BigInt(afterEventId);
  } catch {
    return [];
  }

  return withAuthRls(uid, async (tx) => {
    const rows = await tx.agentSessionEvent.findMany({
      where: {
        userId: uid,
        vertexSessionId,
        id: { gt: after },
      },
      orderBy: { id: "asc" },
      take: AGENT_EVENT_BUFFER_LIMIT,
      select: {
        id: true,
        eventType: true,
        message: true,
        eventTimestamp: true,
      },
    });
    return rows.map(toDelivery);
  });
}
