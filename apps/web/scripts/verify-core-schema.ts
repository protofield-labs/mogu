/**
 * Core schema verification (#27 Definition of Done).
 * Run via: DATABASE_URL=... pnpm exec tsx scripts/verify-core-schema.ts
 */
import { PrismaClient, Rating } from "@prisma/client";

import { createRlsHarness, runVerifyScript } from "./test-helpers/rls-harness";

const prisma = new PrismaClient();
const { withRls, runInRollbackTransaction } = createRlsHarness(prisma);

async function assertNoSavedCountColumn() {
  const rows = await prisma.$queryRaw<
    { table_name: string; column_name: string }[]
  >`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name IN ('saved_count', 'savedCount')
  `;
  if (rows.length > 0) {
    throw new Error(
      `savedCount must not be a DB column; found: ${rows.map((r) => `${r.table_name}.${r.column_name}`).join(", ")}`,
    );
  }
}

async function assertFlagTriggerAnonymizesDepth2() {
  const uidOrigin = "core-schema-origin";
  const uidActor = "core-schema-actor";
  const low = uidOrigin < uidActor ? uidOrigin : uidActor;
  const high = uidOrigin < uidActor ? uidActor : uidOrigin;

  await runInRollbackTransaction(async (tx) => {
    for (const [uid, name] of [
      [uidOrigin, "Origin"],
      [uidActor, "Actor"],
    ] as const) {
      await withRls(tx, uid, (scoped) =>
        scoped.user.upsert({
          where: { firebaseUid: uid },
          create: { firebaseUid: uid, displayName: name },
          update: { displayName: name },
        }),
      );
    }

    await withRls(tx, uidOrigin, (scoped) =>
      scoped.friendship.create({
        data: {
          userLow: low,
          userHigh: high,
          status: "accepted",
          requestedBy: uidOrigin,
          acceptedAt: new Date(),
        },
      }),
    );

    const collectionId = await withRls(tx, uidActor, async (scoped) => {
      const collection = await scoped.collection.create({
        data: {
          ownerId: uidActor,
          name: "Actor collection",
          visibility: "friends",
        },
      });
      return collection.id;
    });

    const newSpot = await withRls(tx, uidActor, (scoped) =>
      scoped.spot.create({
        data: {
          placeId: "places/test-trigger",
          addedBy: uidActor,
          collectionId,
          rating: Rating.again,
          originUserId: uidOrigin,
          depth: 2,
        },
      }),
    );

    await withRls(tx, uidActor, (scoped) =>
      scoped.recollectionEdge.create({
        data: {
          spotId: newSpot.id,
          sourceSpotId: null,
          actorId: uidActor,
          originUserId: uidOrigin,
          depth: 2,
        },
      }),
    );

    const flags = await withRls(tx, uidOrigin, (scoped) =>
      scoped.flag.findMany({
        where: { recipientId: uidOrigin },
        orderBy: { createdAt: "desc" },
        take: 1,
      }),
    );
    const flag = flags[0];
    if (!flag) {
      throw new Error("Expected flag row after depth>=2 recollection");
    }
    if (flag.actorId !== null || !flag.isAnonymous) {
      throw new Error(
        `Expected anonymous flag at depth>=2, got actorId=${flag.actorId}, isAnonymous=${flag.isAnonymous}`,
      );
    }
  });
}

async function main() {
  await assertNoSavedCountColumn();
  await assertFlagTriggerAnonymizesDepth2();
  console.log("PASS: core schema guardrails verified");
}

runVerifyScript(main, prisma);
