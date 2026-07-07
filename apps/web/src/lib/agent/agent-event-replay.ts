import type { AgentEventDelivery } from "./event-bus-core";

export const AGENT_EVENT_BUFFER_LIMIT = 64;

function parseEventId(id: string | undefined): bigint {
  if (!id) {
    return BigInt(-1);
  }
  try {
    return BigInt(id);
  } catch {
    return BigInt(-1);
  }
}

/** Decide which persisted events to replay for SSE (#67, #66). */
export function filterEventsForReplay(
  events: AgentEventDelivery[],
  afterEventId?: string,
): AgentEventDelivery[] {
  if (events.length === 0) {
    return [];
  }

  const after = parseEventId(afterEventId);
  if (afterEventId) {
    return events.filter((delivery) => parseEventId(delivery.id) > after);
  }

  const last = events[events.length - 1];
  if (!last || last.event.type === "done") {
    return [];
  }

  let lastDoneIndex = -1;
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (events[index]?.event.type === "done") {
      lastDoneIndex = index;
      break;
    }
  }

  return events.slice(lastDoneIndex + 1);
}
