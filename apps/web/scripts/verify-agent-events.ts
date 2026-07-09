/**
 * Agent SSE helpers verification (#45, #66, #67).
 * Run via: pnpm exec tsx scripts/verify-agent-events.ts
 */
import { assert } from "./test-helpers/assert";

import { filterEventsForReplay } from "../src/lib/agent/agent-event-replay";
import {
  fanoutAgentEvent,
  resetAgentEventBusForTests,
  subscribeAgentEvents,
  type AgentEventDelivery,
} from "../src/lib/agent/event-bus-core";
import { formatAgentEventSse, formatSseConnectedComment } from "../src/lib/agent/sse";
import { parseSseBuffer } from "../src/lib/agent/chat-helpers";
import {
  createDoneEvent,
  createThinkingEvent,
  extractThinkingEvent,
} from "../src/lib/agent/stream-parser";

function delivery(
  id: string,
  event: AgentEventDelivery["event"],
): AgentEventDelivery {
  return { id, event };
}

function main() {
  const kenEvent = extractThinkingEvent({ author: "ken" });
  assert(kenEvent?.message === "Kenのコレクションを参照中…", "ken thinking");
  const aoiEvent = extractThinkingEvent({ author: "Aoi" });
  assert(aoiEvent?.message === "Aoiのコレクションを参照中…", "aoi thinking case-insensitive");
  const kenTool = extractThinkingEvent({
    content: { parts: [{ function_call: { name: "ken" } }] },
  });
  assert(kenTool?.message === "Kenのコレクションを参照中…", "ken tool call thinking");

  const thinking = createThinkingEvent("test");
  const sse = formatAgentEventSse(thinking, "1");
  assert(sse.startsWith("id: 1\n"), "sse id prefix");
  assert(JSON.parse(sse.split("\n")[1]!.slice(6)).type === "thinking", "sse json");

  const connected = parseSseBuffer(`${formatSseConnectedComment()}${sse}`);
  assert(connected.connected, "parse connected comment");
  assert(connected.lastEventId === "1", "parse last event id");

  const done = createDoneEvent();
  assert(
    filterEventsForReplay([
      delivery("1", thinking),
      delivery("2", done),
    ]).length === 0,
    "completed turn is not replayed on fresh connect",
  );
  assert(
    filterEventsForReplay(
      [delivery("1", thinking), delivery("2", done), delivery("3", thinking)],
    ).length === 1,
    "new turn replays only current thinking",
  );
  assert(
    filterEventsForReplay(
      [delivery("1", thinking), delivery("2", done)],
      "1",
    ).length === 1,
    "Last-Event-ID replay skips older events",
  );

  resetAgentEventBusForTests();
  const received: string[] = [];
  subscribeAgentEvents("uid-1", "123", (eventDelivery) => {
    received.push(`${eventDelivery.id}:${eventDelivery.event.type}`);
  });
  fanoutAgentEvent("uid-1", "123", delivery("1", thinking));
  fanoutAgentEvent("uid-1", "123", delivery("2", done));
  assert(
    received.join(",") === "1:thinking,2:done",
    "local fanout delivers to subscriber",
  );

  resetAgentEventBusForTests();
  const otherSession: string[] = [];
  subscribeAgentEvents("uid-1", "456", (eventDelivery) => {
    otherSession.push(eventDelivery.event.type);
  });
  fanoutAgentEvent("uid-1", "123", delivery("1", thinking));
  fanoutAgentEvent("uid-1", "456", delivery("2", thinking));
  assert(otherSession.join(",") === "thinking", "no cross-session leak");

  console.log("PASS: agent SSE helpers");
}

main();
