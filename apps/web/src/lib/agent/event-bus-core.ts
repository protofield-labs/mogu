import type { AgentEvent } from "./types";

type Listener = (event: AgentEvent) => void;

const channels = new Map<string, Set<Listener>>();

function channelKey(userId: string, sessionId: string): string {
  return `${userId}:${sessionId}`;
}

/** Subscribe to thinking/done events for a session (#45). */
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

/** Publish an AgentEvent to SSE subscribers (#45). */
export function publishAgentEvent(
  userId: string,
  sessionId: string,
  event: AgentEvent,
): void {
  const listeners = channels.get(channelKey(userId, sessionId));
  if (!listeners) {
    return;
  }
  for (const listener of listeners) {
    listener(event);
  }
}

/** Reset subscribers (tests only). */
export function resetAgentEventBusForTests(): void {
  channels.clear();
}
