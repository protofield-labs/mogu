/**
 * Agent SSE helpers verification (#45, #67 Definition of Done).
 * Run via: pnpm exec tsx scripts/verify-agent-events.ts
 */
import { assert } from "./test-helpers/assert";

import {
  listBufferedAgentEvents,
  publishAgentEvent,
  resetAgentEventBusForTests,
  subscribeAgentEvents,
} from "../src/lib/agent/event-bus-core";
import { parseSseBuffer } from "../src/lib/agent/chat-helpers";
import {
  formatAgentEventSse,
  formatSseConnectedComment,
} from "../src/lib/agent/sse";
import {
  createDoneEvent,
  createThinkingEvent,
  extractThinkingEvent,
} from "../src/lib/agent/stream-parser";

function main() {
  const kenEvent = extractThinkingEvent({ author: "ken" });
  assert(kenEvent?.message === "Kenのコレクションを参照中…", "ken thinking");
  assert(kenEvent?.type === "thinking", "ken type");

  const aoiEvent = extractThinkingEvent({ author: "aoi" });
  assert(aoiEvent?.message === "Aoiのコレクションを参照中…", "aoi thinking");

  const toolEvent = extractThinkingEvent({
    author: "mogu_orchestrator",
    content: { parts: [{ function_call: { name: "ken" } }] },
  });
  assert(
    toolEvent?.message === "エージェントが情報を集めています…",
    "function_call thinking",
  );

  assert(
    extractThinkingEvent({ author: "mogu_orchestrator" }) === null,
    "orchestrator alone emits no thinking",
  );

  const thinking = createThinkingEvent("test");
  const sse = formatAgentEventSse(thinking, "1");
  assert(sse.startsWith("id: 1\n"), "sse id prefix");
  assert(sse.includes("data: "), "sse data prefix");
  assert(sse.endsWith("\n\n"), "sse frame ending");
  assert(JSON.parse(sse.split("\n")[1]!.slice(6)).type === "thinking", "sse json");

  const connected = parseSseBuffer(`${formatSseConnectedComment()}${sse}`);
  assert(connected.connected, "parse connected comment");
  assert(connected.events.length === 1, "parse replayed event with id");
  assert(connected.lastEventId === "1", "parse last event id");

  const done = createDoneEvent();
  assert(done.type === "done", "done event type");

  resetAgentEventBusForTests();
  const received: string[] = [];
  subscribeAgentEvents("uid-1", "123", (delivery) => {
    received.push(`${delivery.id}:${delivery.event.type}`);
  });
  publishAgentEvent("uid-1", "123", thinking);
  publishAgentEvent("uid-1", "123", done);
  assert(
    received.join(",") === "1:thinking,2:done",
    "event bus delivers to subscriber with ids",
  );

  resetAgentEventBusForTests();
  publishAgentEvent("uid-1", "123", thinking);
  publishAgentEvent("uid-1", "123", done);
  const replay = listBufferedAgentEvents("uid-1", "123", "0");
  assert(replay.length === 2, "buffer keeps turn events for reconnect");
  assert(
    listBufferedAgentEvents("uid-1", "123", "1").length === 1,
    "Last-Event-ID replay skips older events",
  );
  assert(
    listBufferedAgentEvents("uid-1", "123").length === 0,
    "completed turn is not replayed on fresh connect",
  );

  resetAgentEventBusForTests();
  publishAgentEvent("uid-1", "123", thinking);
  publishAgentEvent("uid-1", "123", done);
  publishAgentEvent("uid-1", "123", createThinkingEvent("next turn"));
  assert(
    listBufferedAgentEvents("uid-1", "123").length === 1,
    "new turn clears previous buffer",
  );

  resetAgentEventBusForTests();
  const otherSession: string[] = [];
  subscribeAgentEvents("uid-1", "456", (delivery) => {
    otherSession.push(delivery.event.type);
  });
  publishAgentEvent("uid-1", "123", thinking);
  publishAgentEvent("uid-1", "456", thinking);
  assert(otherSession.join(",") === "thinking", "no cross-session leak");

  console.log("PASS: agent SSE helpers");
}

main();
