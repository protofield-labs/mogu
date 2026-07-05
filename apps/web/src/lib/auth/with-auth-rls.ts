import "server-only";

import { withRls } from "@/lib/db/rls";
import type { PrismaTransaction } from "@/lib/db/prisma";

/** Run RLS-scoped queries for an authenticated uid (#29 auth bridge). */
export async function withAuthRls<T>(
  uid: string,
  fn: (tx: PrismaTransaction) => Promise<T>,
): Promise<T> {
  return withRls(uid, fn);
}
