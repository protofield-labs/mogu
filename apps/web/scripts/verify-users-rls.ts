/**
 * RLS verification for users table (Issue #16 Definition of Done).
 * Run via: DATABASE_URL=... ./scripts/verify-users-rls.sh
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const UID_A = "rls-test-user-a";
const UID_B = "rls-test-user-b";

async function withRls<T>(
  uid: string,
  fn: (tx: Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_user_id', ${uid}, true)`;
    return fn(tx);
  });
}

async function main() {
  await withRls(UID_A, async (tx) => {
    await tx.user.upsert({
      where: { firebaseUid: UID_A },
      create: {
        firebaseUid: UID_A,
        displayName: "RLS Test A",
      },
      update: { displayName: "RLS Test A" },
    });
  });

  await withRls(UID_B, async (tx) => {
    await tx.user.upsert({
      where: { firebaseUid: UID_B },
      create: {
        firebaseUid: UID_B,
        displayName: "RLS Test B",
      },
      update: { displayName: "RLS Test B" },
    });
  });

  const visibleAsA = await withRls(UID_A, (tx) =>
    tx.user.findMany({ select: { firebaseUid: true } }),
  );
  if (visibleAsA.length !== 1 || visibleAsA[0]?.firebaseUid !== UID_A) {
    throw new Error(
      `Expected UID_A to see only itself, got: ${JSON.stringify(visibleAsA)}`,
    );
  }

  const visibleAsB = await withRls(UID_B, (tx) =>
    tx.user.findMany({ select: { firebaseUid: true } }),
  );
  if (visibleAsB.length !== 1 || visibleAsB[0]?.firebaseUid !== UID_B) {
    throw new Error(
      `Expected UID_B to see only itself, got: ${JSON.stringify(visibleAsB)}`,
    );
  }

  let insertBlocked = false;
  try {
    await withRls(UID_A, (tx) =>
      tx.user.create({
        data: {
          firebaseUid: "rls-test-impersonation",
          displayName: "Should fail",
        },
      }),
    );
  } catch (error) {
    // Only a policy rejection counts; connection errors etc. must not pass.
    const message = error instanceof Error ? error.message : String(error);
    if (!/row-level security|42501/i.test(message)) {
      throw new Error(`INSERT failed for an unexpected reason: ${message}`);
    }
    insertBlocked = true;
  }
  if (!insertBlocked) {
    throw new Error("Expected INSERT with foreign firebase_uid to fail WITH CHECK");
  }

  await withRls(UID_A, (tx) =>
    tx.user.update({
      where: { firebaseUid: UID_A },
      data: { displayName: "RLS Test A Updated" },
    }),
  );

  // DELETE must also go through USING: deleting another user's row is a no-op.
  const crossDelete = await withRls(UID_A, (tx) =>
    tx.user.deleteMany({ where: { firebaseUid: UID_B } }),
  );
  if (crossDelete.count !== 0) {
    throw new Error(
      `Expected DELETE of foreign row to affect 0 rows, got ${crossDelete.count}`,
    );
  }

  // Cleanup doubles as verification that users can delete their own row.
  await withRls(UID_A, (tx) =>
    tx.user.delete({ where: { firebaseUid: UID_A } }),
  );
  await withRls(UID_B, (tx) =>
    tx.user.delete({ where: { firebaseUid: UID_B } }),
  );

  console.log("PASS: users RLS self_only policy verified");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
