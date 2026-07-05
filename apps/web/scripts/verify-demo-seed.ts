/**
 * Demo seed verification (#46 Definition of Done).
 * Run via: pnpm exec tsx scripts/verify-demo-seed.ts
 *
 * Requires DATABASE_URL and applied migrations (including demo_seed_policy).
 * Runs seed idempotently before assertions.
 */
import { PrismaClient } from "@prisma/client";

import {
  DEMO_COLLECTION_IDS,
  DEMO_PERSONAS,
  DEMO_SHARED_PLACE_ID,
  DEMO_SPOT_IDS,
  DEMO_VIEWER_DEFAULT,
} from "../src/lib/seed/demo-data";
import { withSeedRls } from "../src/lib/seed/rls";

const prisma = new PrismaClient();

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const viewerUid = process.env.SEED_VIEWER_UID?.trim() || DEMO_VIEWER_DEFAULT.uid;

  await prisma.$transaction(async (tx) => {
    const kenCollections = await withSeedRls(tx, viewerUid, (scoped) =>
      scoped.collection.findMany({
        where: { ownerId: DEMO_PERSONAS.ken.uid },
      }),
    );
    assert(kenCollections.length >= 2, "viewer can see Ken collections via RLS");

    const secretCollection = await withSeedRls(tx, viewerUid, (scoped) =>
      scoped.collection.findUnique({
        where: { id: DEMO_COLLECTION_IDS.aoiAnniversary },
      }),
    );
    assert(secretCollection === null, "viewer cannot see Aoi secret collection");

    const sharedSpots = await withSeedRls(tx, viewerUid, (scoped) =>
      scoped.spot.findMany({
        where: { placeId: DEMO_SHARED_PLACE_ID },
      }),
    );
    assert(sharedSpots.length >= 3, "shared place_id visible across friend spots");

    const circleSaved = await tx.$queryRaw<{ count: bigint }[]>`
      SELECT count(DISTINCT s.added_by) AS count
      FROM spots s
      WHERE s.place_id = ${DEMO_SHARED_PLACE_ID}
        AND (
          s.added_by = ${viewerUid}
          OR EXISTS (
            SELECT 1 FROM friendships f
            WHERE f.status = 'accepted'
              AND f.user_low = LEAST(s.added_by, ${viewerUid})
              AND f.user_high = GREATEST(s.added_by, ${viewerUid})
          )
        )
    `;
    assert(
      Number(circleSaved[0]?.count ?? 0) >= 3,
      "savedCount circle has at least 3 distinct savers",
    );

    const daily = await withSeedRls(tx, viewerUid, (scoped) =>
      scoped.dailyRecommendation.findFirst({
        where: { userId: viewerUid },
      }),
    );
    assert(daily !== null, "daily recommendation exists for viewer");
    assert(
      daily!.spotId === DEMO_SPOT_IDS.kenSharedIzakaya,
      "daily recommendation references Ken spot",
    );

    const kenFlags = await withSeedRls(tx, DEMO_PERSONAS.ken.uid, (scoped) =>
      scoped.flag.findMany({
        where: { recipientId: DEMO_PERSONAS.ken.uid },
      }),
    );
    assert(kenFlags.length >= 1, "Ken received flag from viewer recollection");
    assert(
      kenFlags.some((f) => f.spotId === DEMO_SPOT_IDS.viewerRecoFromKen),
      "Ken flag references recollected spot",
    );
  });

  console.log("PASS: demo seed verification");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
