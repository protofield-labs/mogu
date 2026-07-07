/**
 * Agent consultation RLS verification (#153).
 * Run via: DATABASE_URL=... pnpm exec tsx scripts/verify-agent-consultations-rls.ts
 */
import { PrismaClient } from "@prisma/client";

import {
  createAgentEntry,
  createUserEntry,
  createWelcomeEntry,
} from "../src/lib/agent/chat-helpers";
import { createRlsHarness, runVerifyScript } from "./test-helpers/rls-harness";

const prisma = new PrismaClient();
const { withRls, upsertUser, runInRollbackTransaction } =
  createRlsHarness(prisma);

const UID_OWNER = "rls-agent-consult-owner";
const UID_OTHER = "rls-agent-consult-other";

async function verifyAgentConsultationRls() {
  await runInRollbackTransaction(async (tx) => {
    await upsertUser(tx, UID_OWNER, "Owner");
    await upsertUser(tx, UID_OTHER, "Other");

    const welcome = createWelcomeEntry();
    const user = createUserEntry("恵比寿で2人");
    if (user.kind !== "user") {
      throw new Error("expected user entry");
    }
    const entries = [welcome, user, createAgentEntry({ text: "了解です" })];

    const consultationId = await withRls(tx, UID_OWNER, async (scoped) => {
      const row = await scoped.agentConsultation.create({
        data: {
          userId: UID_OWNER,
          vertexSessionId: "1234567890123456",
          title: "恵比寿で2人",
          entries,
        },
      });
      return row.id;
    });

    const ownerRows = await withRls(tx, UID_OWNER, (scoped) =>
      scoped.agentConsultation.findMany({
        where: { userId: UID_OWNER },
      }),
    );
    if (ownerRows.length !== 1 || ownerRows[0]?.id !== consultationId) {
      throw new Error("Owner should read own consultation");
    }

    const otherRows = await withRls(tx, UID_OTHER, (scoped) =>
      scoped.agentConsultation.findMany({
        where: { id: consultationId },
      }),
    );
    if (otherRows.length !== 0) {
      throw new Error("Other user must not read foreign consultation");
    }

    await withRls(tx, UID_OTHER, async (scoped) => {
      const updated = await scoped.agentConsultation.updateMany({
        where: { id: consultationId },
        data: { title: "hacked" },
      });
      if (updated.count !== 0) {
        throw new Error("Other user must not update foreign consultation");
      }
    });
  });
}

async function main() {
  await verifyAgentConsultationRls();
  console.log("PASS: agent consultation RLS verified");
}

runVerifyScript(main, prisma);
