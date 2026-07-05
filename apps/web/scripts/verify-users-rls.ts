/**
 * RLS verification for users table (#28 Definition of Done).
 * Run via: DATABASE_URL=... ./scripts/verify-users-rls.sh
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const UID_A = "rls-test-user-a";
const UID_B = "rls-test-user-b";

class Rollback extends Error {
  constructor() {
    super("rollback");
  }
}

async function withRls<T>(
  uid: string,
  fn: (
    tx: Omit<
      PrismaClient,
      "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
    >,
  ) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_user_id', ${uid}, true)`;
    return fn(tx);
  });
}

async function main() {
  try {
    await prisma.$transaction(async (tx) => {
      await withRls(UID_A, async (scoped) => {
        await scoped.user.upsert({
          where: { firebaseUid: UID_A },
          create: {
            firebaseUid: UID_A,
            displayName: "RLS Test A",
          },
          update: { displayName: "RLS Test A" },
        });
      });

      await withRls(UID_B, async (scoped) => {
        await scoped.user.upsert({
          where: { firebaseUid: UID_B },
          create: {
            firebaseUid: UID_B,
            displayName: "RLS Test B",
          },
          update: { displayName: "RLS Test B" },
        });
      });

      const visibleAsA = await withRls(UID_A, (scoped) =>
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

      let insertBlocked = false;
      try {
        await withRls(UID_A, (scoped) =>
          scoped.user.create({
            data: {
              firebaseUid: "rls-test-impersonation",
              displayName: "Should fail",
            },
          }),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!/row-level security|42501/i.test(message)) {
          throw new Error(`INSERT failed for an unexpected reason: ${message}`);
        }
        insertBlocked = true;
      }
      if (!insertBlocked) {
        throw new Error(
          "Expected INSERT with foreign firebase_uid to fail WITH CHECK",
        );
      }

      await withRls(UID_A, (scoped) =>
        scoped.user.update({
          where: { firebaseUid: UID_A },
          data: { displayName: "RLS Test A Updated" },
        }),
      );

      const crossUpdate = await withRls(UID_A, (scoped) =>
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

      const crossDelete = await withRls(UID_A, (scoped) =>
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
