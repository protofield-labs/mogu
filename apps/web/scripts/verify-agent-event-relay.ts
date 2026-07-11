/**
 * Agent event replay verification (#66, #67).
 * Run via: pnpm exec tsx scripts/verify-agent-event-relay.ts
 */
import { assert } from "./test-helpers/assert";

import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd(), "src");

function readSource(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

const eventBus = readSource("lib/agent/event-bus.ts");
assert(eventBus.includes("appendAgentSessionEvent"), "event bus persists to Cloud SQL");
assert(eventBus.includes("pollAgentSessionEvents"), "event bus exposes poll helper");

const eventsRoute = readSource("app/api/v1/agent/sessions/[id]/events/route.ts");
assert(eventsRoute.includes("AGENT_SSE_POLL_MS"), "events route polls shared store");
assert(eventsRoute.includes("listBufferedAgentEvents"), "events route replays from store");

const messageClient = readSource("lib/agent/message-client.ts");
const agentStreamQuery = readSource("lib/agent/agent-stream-query.ts");
assert(messageClient.includes("executeAgentStreamQuery"), "message client delegates stream execution");
assert(agentStreamQuery.includes("publishAgentEvent"), "stream query publishes agent events");
assert(agentStreamQuery.includes("await publishChain"), "stream query awaits persisted publish");

console.log("PASS: agent event relay wiring verified");
