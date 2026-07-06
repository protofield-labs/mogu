/**
 * RLS verification for users table (#28 Definition of Done).
 * Run via: DATABASE_URL=... pnpm exec tsx scripts/verify-users-rls.ts
 *
 * All mutations run inside a single transaction and are rolled back;
 * the expected-failure INSERT runs in its own transaction because a
 * policy violation aborts the enclosing Postgres transaction.
 */
import { PrismaClient } from "@prisma/client";

import {
  RollbackError,
  createRlsHarness,
  runVerifyScript,
} from "./test-helpers/rls-harness";

const prisma = new PrismaClient();
const { withRls, upsertUser, runInRollbackTransaction } =
  createRlsHarness(prisma);

const UID_A = "rls-test-user-a";
const UID_B = "rls-test-user-b";

async function verifyPublicSelectAndSelfMutations() {
  await runInRollbackTransaction(async (tx) => {
    await upsertUser(tx, UID_A, "RLS Test A");
    await upsertUser(tx, UID_B, "RLS Test B");

    const visibleAsA = await withRls(tx, UID_A, (scoped) =>
      scoped.user.findMany({
        where: { firebaseUid: { in: [UID_A, UID_B] } },
        select: {
          firebaseUid: true,
          displayName: true,
          avatarColor: true,
        },
        orderBy: { firebaseUid: "asc" },
      }),
    );
    if (visibleAsA.length !== 2) {
      throw new Error(
        `Expected UID_A to see both users under public SELECT, got: ${JSON.stringify(visibleAsA)}`,
      );
    }
    const userB = visibleAsA.find((row) => row.firebaseUid === UID_B);
    if (!userB || userB.displayName !== "RLS Test B") {
      throw new Error(
        `Expected UID_A to read UID_B displayName, got: ${JSON.stringify(userB)}`,
      );
    }
    if (userB.avatarColor !== "#888888") {
      throw new Error(
        `Expected default avatarColor '#888888', got: ${userB.avatarColor}`,
      );
    }

    await withRls(tx, UID_A, (scoped) =>
      scoped.user.update({
        where: { firebaseUid: UID_A },
        data: { displayName: "RLS Test A Updated" },
      }),
    );

    const crossUpdate = await withRls(tx, UID_A, (scoped) =>
      scoped.user.updateMany({
        where: { firebaseUid: UID_B },
        data: { displayName: "Should not apply" },
      }),
    );
    if (crossUpdate.count !== 0) {
      throw new Error(
        `Expected UPDATE of foreign row to affect 0 rows, got ${crossUpdate.count}`,
      );
    }

    const crossDelete = await withRls(tx, UID_A, (scoped) =>
      scoped.user.deleteMany({ where: { firebaseUid: UID_B } }),
    );
    if (crossDelete.count !== 0) {
      throw new Error(
        `Expected DELETE of foreign row to affect 0 rows, got ${crossDelete.count}`,
      );
    }
  });
}

async function verifyForeignInsertBlocked() {
  let insertBlocked = false;
  try {
    await prisma.$transaction(async (tx) => {
      await withRls(tx, UID_A, (scoped) =>
        scoped.user.create({
          data: {
            firebaseUid: "rls-test-impersonation",
            displayName: "Should fail",
          },
        }),
      );
      throw new RollbackError();
    });
  } catch (error) {
    if (error instanceof RollbackError) {
      // INSERT unexpectedly succeeded; fall through to the failure below.
    } else {
      const message = error instanceof Error ? error.message : String(error);
      if (!/row-level security|42501/i.test(message)) {
        throw new Error(`INSERT failed for an unexpected reason: ${message}`);
      }
      insertBlocked = true;
    }
  }
  if (!insertBlocked) {
    throw new Error(
      "Expected INSERT with foreign firebase_uid to fail WITH CHECK",
    );
  }
}

async function main() {
  await verifyPublicSelectAndSelfMutations();
  await verifyForeignInsertBlocked();
  console.log("PASS: users RLS public SELECT + self INSERT/UPDATE verified");
}

runVerifyScript(main, prisma);
