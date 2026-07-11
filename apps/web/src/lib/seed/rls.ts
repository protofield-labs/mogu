import type { PrismaClient } from "@prisma/client";

type Tx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;

/** Run a callback with app.current_user_id set for RLS (#46 seed). */
export async function withSeedRls<T>(
  tx: Tx,
  uid: string,
  fn: (scoped: Tx) => Promise<T>,
): Promise<T> {
  await tx.$executeRaw`SELECT set_config('app.current_user_id', ${uid}, true)`;
  return fn(tx);
}

/** Enable demo seed inserts for tables gated by session flags. */
export async function enableDemoSeedFlags(tx: Tx): Promise<void> {
  await tx.$executeRaw`SELECT set_config('app.demo_seed', '1', true)`;
}

/** Demo seed flags plus viewer uid for scoped delete policies (#331). */
export async function enableDemoSeedContext(tx: Tx, viewerUid: string): Promise<void> {
  await enableDemoSeedFlags(tx);
  await tx.$executeRaw`SELECT set_config('app.current_user_id', ${viewerUid}, true)`;
}

export async function disableDemoSeedFlags(tx: Tx): Promise<void> {
  await tx.$executeRaw`SELECT set_config('app.demo_seed', '', true)`;
}
