import {
  AgentEngineNotConfiguredError,
  AgentSessionForbiddenError,
  AgentSessionNotFoundError,
} from "@/lib/agent/errors";
import { subscribeAgentEvents } from "@/lib/agent/event-bus";
import { assertAgentSessionOwnership } from "@/lib/agent/session-client";
import { isValidSessionId } from "@/lib/agent/session-id";
import {
  AGENT_SSE_HEADERS,
  AGENT_SSE_KEEPALIVE_MS,
  formatAgentEventSse,
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

/**
 * SSE stream of thinking/done events for an agent session (#45).
 * Client opens this before POST /messages; events are published during streamQuery.
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

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        let closed = false;

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

        const close = () => {
          if (closed) {
            return;
          }
          closed = true;
          clearInterval(keepalive);
          unsubscribe();
          try {
            controller.close();
          } catch {
            // Stream already closed by the client.
          }
        };

        const unsubscribe = subscribeAgentEvents(uid, sessionId, (event) => {
          push(formatAgentEventSse(event));
        });

        const keepalive = setInterval(() => {
          push(formatSseKeepalive());
        }, AGENT_SSE_KEEPALIVE_MS);

        req.signal.addEventListener("abort", close, { once: true });
      },
    });

    return new Response(stream, { headers: AGENT_SSE_HEADERS });
  });
}
