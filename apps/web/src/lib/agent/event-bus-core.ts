import type { AgentEvent } from "./types";

type Listener = (delivery: AgentEventDelivery) => void;

export type AgentEventDelivery = {
  id: string;
  event: AgentEvent;
};

const channels = new Map<string, Set<Listener>>();

function channelKey(userId: string, sessionId: string): string {
  return `${userId}:${sessionId}`;
}

/** Subscribe to thinking/done events on this instance (#45). */
export function subscribeAgentEvents(
  userId: string,
  sessionId: string,
  listener: Listener,
): () => void {
  const key = channelKey(userId, sessionId);
  let listeners = channels.get(key);
  if (!listeners) {
    listeners = new Set();
    channels.set(key, listeners);
  }
  listeners.add(listener);

  return () => {
    listeners?.delete(listener);
    if (listeners && listeners.size === 0) {
      channels.delete(key);
    }
  };
}

/** Fan out a persisted delivery to local SSE subscribers on this instance (#66). */
export function fanoutAgentEvent(
  userId: string,
  sessionId: string,
  delivery: AgentEventDelivery,
): void {
  const listeners = channels.get(channelKey(userId, sessionId));
  if (!listeners) {
    return;
  }
  for (const listener of listeners) {
    listener(delivery);
  }
}

/** Reset subscribers (tests only). */
export function resetAgentEventBusForTests(): void {
  channels.clear();
}
