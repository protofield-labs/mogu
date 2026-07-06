/**
 * Agent SSE helpers verification (#45 Definition of Done).
 * Run via: pnpm exec tsx scripts/verify-agent-events.ts
 */
import { assert } from "./test-helpers/assert";

import {
  publishAgentEvent,
  resetAgentEventBusForTests,
  subscribeAgentEvents,
} from "../src/lib/agent/event-bus-core";
import { formatAgentEventSse } from "../src/lib/agent/sse";
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
  const sse = formatAgentEventSse(thinking);
  assert(sse.startsWith("data: "), "sse data prefix");
  assert(sse.endsWith("\n\n"), "sse frame ending");
  assert(JSON.parse(sse.slice(6).trim()).type === "thinking", "sse json");

  const done = createDoneEvent();
  assert(done.type === "done", "done event type");

  resetAgentEventBusForTests();
  const received: string[] = [];
  subscribeAgentEvents("uid-1", "123", (event) => {
    received.push(event.type);
  });
  publishAgentEvent("uid-1", "123", thinking);
  publishAgentEvent("uid-1", "123", done);
  assert(
    received.join(",") === "thinking,done",
    "event bus delivers to subscriber",
  );

  resetAgentEventBusForTests();
  const otherSession: string[] = [];
  subscribeAgentEvents("uid-1", "456", (event) => {
    otherSession.push(event.type);
  });
  publishAgentEvent("uid-1", "123", thinking);
  publishAgentEvent("uid-1", "456", thinking);
  assert(otherSession.join(",") === "thinking", "no cross-session leak");

  console.log("PASS: agent SSE helpers");
}

main();
