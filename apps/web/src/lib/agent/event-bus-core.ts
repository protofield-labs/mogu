import type { AgentEvent } from "./types";

type Listener = (delivery: AgentEventDelivery) => void;

export type AgentEventDelivery = {
  id: string;
  event: AgentEvent;
};

type ChannelState = {
  listeners: Set<Listener>;
  buffer: AgentEventDelivery[];
  nextId: number;
  turnComplete: boolean;
};

const channels = new Map<string, ChannelState>();

/** Keep enough frames for one turn's thinking steps + reconnect replay (#67). */
export const AGENT_EVENT_BUFFER_LIMIT = 64;

function channelKey(userId: string, sessionId: string): string {
  return `${userId}:${sessionId}`;
}

function getOrCreateChannel(key: string): ChannelState {
  let state = channels.get(key);
  if (!state) {
    state = {
      listeners: new Set(),
      buffer: [],
      nextId: 1,
      turnComplete: false,
    };
    channels.set(key, state);
  }
  return state;
}

function parseEventId(id: string | undefined): number {
  if (!id) {
    return -1;
  }
  const parsed = Number.parseInt(id, 10);
  return Number.isFinite(parsed) ? parsed : -1;
}

/** Buffered events newer than Last-Event-ID for SSE replay (#67). */
export function listBufferedAgentEvents(
  userId: string,
  sessionId: string,
  afterEventId?: string,
): AgentEventDelivery[] {
  const state = channels.get(channelKey(userId, sessionId));
  if (!state) {
    return [];
  }

  // A fresh connection after a completed turn should not replay stale thinking.
  if (!afterEventId && state.turnComplete) {
    return [];
  }

  const after = parseEventId(afterEventId);
  return state.buffer.filter((delivery) => parseEventId(delivery.id) > after);
}

/** Subscribe to thinking/done events for a session (#45). */
export function subscribeAgentEvents(
  userId: string,
  sessionId: string,
  listener: Listener,
): () => void {
  const key = channelKey(userId, sessionId);
  const state = getOrCreateChannel(key);
  state.listeners.add(listener);

  return () => {
    state.listeners.delete(listener);
    if (state.listeners.size === 0 && state.buffer.length === 0) {
      channels.delete(key);
    }
  };
}

/** Publish an AgentEvent to SSE subscribers and the short-term buffer (#45, #67). */
export function publishAgentEvent(
  userId: string,
  sessionId: string,
  event: AgentEvent,
): AgentEventDelivery {
  const key = channelKey(userId, sessionId);
  const state = getOrCreateChannel(key);

  if (event.type === "thinking" && state.turnComplete) {
    state.buffer = [];
    state.turnComplete = false;
  }

  const delivery: AgentEventDelivery = {
    id: String(state.nextId++),
    event,
  };

  state.buffer.push(delivery);
  if (state.buffer.length > AGENT_EVENT_BUFFER_LIMIT) {
    state.buffer.shift();
  }

  if (event.type === "done") {
    state.turnComplete = true;
  }

  for (const listener of state.listeners) {
    listener(delivery);
  }

  return delivery;
}

/** Reset subscribers and buffers (tests only). */
export function resetAgentEventBusForTests(): void {
  channels.clear();
}
