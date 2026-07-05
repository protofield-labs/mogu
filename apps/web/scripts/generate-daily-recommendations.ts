/**
 * Nightly batch: generate daily_recommendations for all users (#42).
 * Run via: DATABASE_URL=... pnpm exec tsx scripts/generate-daily-recommendations.ts
 *
 * Cloud Scheduler can invoke this as a Cloud Run Job. Uses
 * upsert_daily_recommendation() (SECURITY DEFINER) for UNIQUE(user_id, valid_date).
 */
import { PrismaClient } from "@prisma/client";

import { pickDailyRecommendation } from "../src/lib/recommendations/pick";
import { jstTodayDate } from "../src/lib/recommendations/valid-date";

const prisma = new PrismaClient();

async function withUserRls<T>(
  tx: Omit<
    PrismaClient,
    "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
  >,
  uid: string,
  fn: (
    scoped: Omit<
      PrismaClient,
      "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
    >,
  ) => Promise<T>,
): Promise<T> {
  await tx.$executeRaw`SELECT set_config('app.current_user_id', ${uid}, true)`;
  return fn(tx);
}

async function main() {
  const validDate = jstTodayDate();
  const users = await prisma.user.findMany({
    select: { firebaseUid: true },
    orderBy: { firebaseUid: "asc" },
  });

  let generated = 0;
  let skipped = 0;

  for (const user of users) {
    await prisma.$transaction(async (tx) => {
      const picked = await withUserRls(tx, user.firebaseUid, (scoped) =>
        pickDailyRecommendation(scoped, user.firebaseUid),
      );
      if (!picked) {
        skipped += 1;
        return;
      }

      await tx.$executeRaw`
        SELECT upsert_daily_recommendation(
          ${user.firebaseUid},
          ${picked.spotId}::uuid,
          ${picked.assertion},
          ${picked.evidence},
          ${validDate}::date
        )
      `;
      generated += 1;
    });
  }

  console.log(
    `PASS: daily recommendations batch (generated=${generated}, skipped=${skipped}, date=${validDate.toISOString().slice(0, 10)})`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
