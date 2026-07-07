/**
 * Agent session event RLS verification (#66).
 * Run via: DATABASE_URL=... pnpm exec tsx scripts/verify-agent-session-events-rls.ts
 */
import { PrismaClient } from "@prisma/client";

import { createThinkingEvent, createDoneEvent } from "../src/lib/agent/stream-parser";
import { createRlsHarness, runVerifyScript } from "./test-helpers/rls-harness";

const prisma = new PrismaClient();
const { withRls, upsertUser, runInRollbackTransaction } =
  createRlsHarness(prisma);

const UID_OWNER = "rls-agent-events-owner";
const UID_OTHER = "rls-agent-events-other";
const SESSION_ID = "1234567890123456";

async function verifyAgentSessionEventRls() {
  await runInRollbackTransaction(async (tx) => {
    await upsertUser(tx, UID_OWNER, "Owner");
    await upsertUser(tx, UID_OTHER, "Other");

    const thinking = createThinkingEvent("Kenのコレクションを参照中…");
    const done = createDoneEvent();

    await withRls(tx, UID_OWNER, (scoped) =>
      scoped.agentSessionEvent.create({
        data: {
          userId: UID_OWNER,
          vertexSessionId: SESSION_ID,
          eventType: thinking.type,
          message: thinking.message,
          eventTimestamp: thinking.timestamp,
        },
      }),
    );

    const ownerRows = await withRls(tx, UID_OWNER, (scoped) =>
      scoped.agentSessionEvent.findMany({
        where: { userId: UID_OWNER, vertexSessionId: SESSION_ID },
      }),
    );
    if (ownerRows.length !== 1) {
      throw new Error("Owner should read own agent session events");
    }

    const otherRows = await withRls(tx, UID_OTHER, (scoped) =>
      scoped.agentSessionEvent.findMany({
        where: { vertexSessionId: SESSION_ID },
      }),
    );
    if (otherRows.length !== 0) {
      throw new Error("Other user must not read foreign agent session events");
    }

    await withRls(tx, UID_OTHER, (scoped) =>
      scoped.agentSessionEvent.create({
        data: {
          userId: UID_OTHER,
          vertexSessionId: SESSION_ID,
          eventType: done.type,
          message: done.message,
          eventTimestamp: done.timestamp,
        },
      }),
    );

    const crossOwnerRead = await withRls(tx, UID_OWNER, (scoped) =>
      scoped.agentSessionEvent.count({
        where: { userId: UID_OTHER },
      }),
    );
    if (crossOwnerRead !== 0) {
      throw new Error("Owner must not read other user's agent session events");
    }
  });
}

async function main() {
  await verifyAgentSessionEventRls();
  console.log("PASS: agent session events RLS verified");
}

runVerifyScript(main, prisma);
