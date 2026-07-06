import type { PrismaClient } from "@prisma/client";

import { assert } from "./assert";

export { assert };

export type RlsTx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;

export class RollbackError extends Error {
  constructor() {
    super("rollback");
  }
}

export type RlsHarness = ReturnType<typeof createRlsHarness>;

export function createRlsHarness(prisma: PrismaClient) {
  async function withRls<T>(
    tx: RlsTx,
    uid: string,
    fn: (scoped: RlsTx) => Promise<T>,
  ): Promise<T> {
    await tx.$executeRaw`SELECT set_config('app.current_user_id', ${uid}, true)`;
    return fn(tx);
  }

  async function upsertUser(
    tx: RlsTx,
    uid: string,
    displayName: string,
  ): Promise<void> {
    await withRls(tx, uid, (scoped) =>
      scoped.user.upsert({
        where: { firebaseUid: uid },
        create: { firebaseUid: uid, displayName },
        update: { displayName },
      }),
    );
  }

  async function runInRollbackTransaction(
    fn: (tx: RlsTx) => Promise<void>,
  ): Promise<void> {
    try {
      await prisma.$transaction(async (tx) => {
        await fn(tx);
        throw new RollbackError();
      });
    } catch (error) {
      if (!(error instanceof RollbackError)) {
        throw error;
      }
    }
  }

  /** RLS-denied ops abort the outer tx unless we roll back to a savepoint. */
  async function expectRlsDenied(
    tx: RlsTx,
    uid: string,
    fn: (scoped: RlsTx) => Promise<unknown>,
  ): Promise<void> {
    await tx.$executeRaw`SAVEPOINT rls_denied`;
    try {
      await withRls(tx, uid, fn);
      await tx.$executeRaw`ROLLBACK TO SAVEPOINT rls_denied`;
      throw new Error("Expected RLS to deny operation");
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "Expected RLS to deny operation"
      ) {
        throw error;
      }
      await tx.$executeRaw`ROLLBACK TO SAVEPOINT rls_denied`;
    }
  }

  async function resolveFriendshipPair(tx: RlsTx, a: string, b: string) {
    const rows = await tx.$queryRaw<{ user_low: string; user_high: string }[]>`
      SELECT LEAST(${a}::text, ${b}::text) AS user_low,
             GREATEST(${a}::text, ${b}::text) AS user_high
    `;
    const row = rows[0];
    if (!row || row.user_low === row.user_high) {
      throw new Error(`Invalid friendship pair: ${a} / ${b}`);
    }
    return { userLow: row.user_low, userHigh: row.user_high };
  }

  return {
    assert,
    withRls,
    upsertUser,
    runInRollbackTransaction,
    expectRlsDenied,
    resolveFriendshipPair,
  };
}

export async function runVerifyScript(
  main: () => Promise<void>,
  prisma?: PrismaClient,
): Promise<void> {
  try {
    await main();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    if (prisma) {
      await prisma.$disconnect();
    }
  }
}
