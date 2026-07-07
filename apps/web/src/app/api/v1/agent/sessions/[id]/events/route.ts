import {
  AgentEngineNotConfiguredError,
  AgentSessionForbiddenError,
  AgentSessionNotFoundError,
} from "@/lib/agent/errors";
import {
  listBufferedAgentEvents,
  pollAgentSessionEvents,
  subscribeAgentEvents,
} from "@/lib/agent/event-bus";
import { assertAgentSessionOwnership } from "@/lib/agent/session-client";
import { isValidSessionId } from "@/lib/agent/session-id";
import {
  AGENT_SSE_HEADERS,
  AGENT_SSE_KEEPALIVE_MS,
  AGENT_SSE_POLL_MS,
  formatAgentEventSse,
  formatSseConnectedComment,
  formatSseKeepalive,
} from "@/lib/agent/sse";
import {
  apiErrorResponse,
  forbiddenResponse,
  notFoundResponse,
  validationErrorResponse,
  withAuthRoute,
} from "@/lib/auth/require-auth";

type RouteParams = {
  params: Promise<{ id: string }>;
};

function parseEventId(id: string): bigint {
  try {
    return BigInt(id);
  } catch {
    return BigInt(-1);
  }
}

/**
 * SSE stream of thinking/done events for an agent session (#45).
 * Replays from Cloud SQL; polls for cross-instance delivery (#66, #67).
 */
export async function GET(
  request: Request,
  { params }: RouteParams,
): Promise<Response> {
  const { id: sessionId } = await params;

  return withAuthRoute(request, async (req, { uid }) => {
    if (!isValidSessionId(sessionId)) {
      return validationErrorResponse("Invalid session id");
    }

    try {
      await assertAgentSessionOwnership(uid, sessionId);
    } catch (error) {
      if (error instanceof AgentEngineNotConfiguredError) {
        return apiErrorResponse(
          "internal",
          "Agent Engine is not configured",
          503,
        );
      }
      if (error instanceof AgentSessionNotFoundError) {
        return notFoundResponse("Agent session not found");
      }
      if (error instanceof AgentSessionForbiddenError) {
        return forbiddenResponse("Agent session forbidden");
      }
      throw error;
    }

    const lastEventId = req.headers.get("Last-Event-ID") ?? undefined;

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        let closed = false;
        let lastSentId = lastEventId ? parseEventId(lastEventId) : BigInt(0);
        let keepalive: ReturnType<typeof setInterval> | undefined;
        let pollTimer: ReturnType<typeof setInterval> | undefined;
        let unsubscribe: (() => void) | undefined;

        const push = (chunk: string) => {
          if (closed) {
            return;
          }
          try {
            controller.enqueue(encoder.encode(chunk));
          } catch {
            closed = true;
          }
        };

        const pushDelivery = (delivery: {
          id: string;
          event: Parameters<typeof formatAgentEventSse>[0];
        }) => {
          const deliveryId = parseEventId(delivery.id);
          if (deliveryId <= lastSentId) {
            return;
          }
          push(formatAgentEventSse(delivery.event, delivery.id));
          lastSentId = deliveryId;
        };

        const close = () => {
          if (closed) {
            return;
          }
          closed = true;
          if (keepalive) {
            clearInterval(keepalive);
          }
          if (pollTimer) {
            clearInterval(pollTimer);
          }
          unsubscribe?.();
          try {
            controller.close();
          } catch {
            // Stream already closed by the client.
          }
        };

        void (async () => {
          try {
            const replay = await listBufferedAgentEvents(
              uid,
              sessionId,
              lastEventId,
            );
            if (closed) {
              return;
            }

            for (const delivery of replay) {
              pushDelivery(delivery);
            }

            push(formatSseConnectedComment());
            if (closed) {
              return;
            }

            unsubscribe = subscribeAgentEvents(uid, sessionId, pushDelivery);

            pollTimer = setInterval(() => {
              if (closed) {
                return;
              }
              void pollAgentSessionEvents(
                uid,
                sessionId,
                lastSentId.toString(),
              )
                .then((deliveries) => {
                  if (closed) {
                    return;
                  }
                  for (const delivery of deliveries) {
                    pushDelivery(delivery);
                  }
                })
                .catch(() => {
                  // Best-effort polling; local fanout may still deliver events.
                });
            }, AGENT_SSE_POLL_MS);

            keepalive = setInterval(() => {
              push(formatSseKeepalive());
            }, AGENT_SSE_KEEPALIVE_MS);
          } catch {
            close();
          }
        })();

        req.signal.addEventListener("abort", close, { once: true });
      },
    });

    return new Response(stream, { headers: AGENT_SSE_HEADERS });
  });
}
