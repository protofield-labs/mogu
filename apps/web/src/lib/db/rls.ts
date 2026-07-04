import "server-only";

import { prisma, type PrismaTransaction } from "./prisma";

/**
 * Run queries with RLS context set for the given Firebase uid (#14, #16).
 * set_config(..., true) is transaction-local so uid cannot leak across pooled connections.
 */
export async function withRls<T>(
  uid: string,
  fn: (tx: PrismaTransaction) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_user_id', ${uid}, true)`;
    return fn(tx);
  });
}
