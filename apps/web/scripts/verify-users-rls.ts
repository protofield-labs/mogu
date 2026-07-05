/**
 * RLS verification for users table (#28 Definition of Done).
 * Run via: DATABASE_URL=... ./scripts/verify-users-rls.sh
 *
 * All mutations run inside a single transaction and are rolled back;
 * the expected-failure INSERT runs in its own transaction because a
 * policy violation aborts the enclosing Postgres transaction.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const UID_A = "rls-test-user-a";
const UID_B = "rls-test-user-b";

type Tx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;

class Rollback extends Error {
  constructor() {
    super("rollback");
  }
}

/** Transaction-local set_config; subsequent calls in the same tx overwrite it. */
async function withRls<T>(
  tx: Tx,
  uid: string,
  fn: (scoped: Tx) => Promise<T>,
): Promise<T> {
  await tx.$executeRaw`SELECT set_config('app.current_user_id', ${uid}, true)`;
  return fn(tx);
}

async function verifyPublicSelectAndSelfMutations() {
  try {
    await prisma.$transaction(async (tx) => {
      for (const [uid, name] of [
        [UID_A, "RLS Test A"],
        [UID_B, "RLS Test B"],
      ] as const) {
        await withRls(tx, uid, (scoped) =>
          scoped.user.upsert({
            where: { firebaseUid: uid },
            create: { firebaseUid: uid, displayName: name },
            update: { displayName: name },
          }),
        );
      }

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

      throw new Rollback();
    });
  } catch (error) {
    if (!(error instanceof Rollback)) {
      throw error;
    }
  }
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
      // If the INSERT unexpectedly succeeds, roll it back before failing.
      throw new Rollback();
    });
  } catch (error) {
    if (error instanceof Rollback) {
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

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
