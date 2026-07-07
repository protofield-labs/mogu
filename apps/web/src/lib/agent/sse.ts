import type { AgentEvent } from "./types";

/** Format AgentEvent as an SSE data frame with monotonic id (#45, #67). */
export function formatAgentEventSse(event: AgentEvent, id: string): string {
  return `id: ${id}\ndata: ${JSON.stringify(event)}\n\n`;
}

/** Sent immediately after replay so clients can POST safely (#67). */
export function formatSseConnectedComment(): string {
  return ": connected\n\n";
}

export const AGENT_SSE_HEADERS: Record<string, string> = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
};

/** SSE comment keepalive (prevents proxy idle timeout). */
export function formatSseKeepalive(): string {
  return ": keepalive\n\n";
}

export const AGENT_SSE_KEEPALIVE_MS = 15_000;

/** Poll shared DB events when publish lands on another Cloud Run instance (#66). */
export const AGENT_SSE_POLL_MS = 300;

export const AGENT_SSE_CONNECTED_MARKER = "connected";
