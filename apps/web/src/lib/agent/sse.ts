import type { AgentEvent } from "./types";

/** Format AgentEvent as an SSE data frame (#45). */
export function formatAgentEventSse(event: AgentEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
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
