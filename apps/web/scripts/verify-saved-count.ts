/**
 * savedCount circle aggregation (#41 Definition of Done).
 * Run via: DATABASE_URL=... pnpm exec tsx scripts/verify-saved-count.ts
 */
import { PrismaClient, Rating } from "@prisma/client";

import {
  createRlsHarness,
  runVerifyScript,
  type RlsTx,
} from "./test-helpers/rls-harness";

const prisma = new PrismaClient();
const { withRls, upsertUser, runInRollbackTransaction } =
  createRlsHarness(prisma);

const UID_A = "rls-savedcount-a";
const UID_B = "rls-savedcount-b";
const UID_C = "rls-savedcount-c";
const PLACE_ID = "ChIJseedSavedCountTest01";

async function countSavedInCircle(tx: RlsTx, uid: string, placeId: string) {
  return withRls(tx, uid, async (scoped) => {
    const rows = await scoped.$queryRaw<{ count: bigint }[]>`
      SELECT count(DISTINCT s.added_by)::bigint AS count
      FROM spots s
      WHERE s.place_id = ${placeId}
        AND (
          s.added_by = app_current_user()
          OR are_friends(s.added_by, app_current_user())
        )
    `;
    return Number(rows[0]?.count ?? 0n);
  });
}

async function verifySavedCountCircle() {
  await runInRollbackTransaction(async (tx) => {
    await upsertUser(tx, UID_A, "User A");
    await upsertUser(tx, UID_B, "User B");
    await upsertUser(tx, UID_C, "User C");

    const pairAB =
      UID_A < UID_B
        ? { userLow: UID_A, userHigh: UID_B }
        : { userLow: UID_B, userHigh: UID_A };

    await withRls(tx, UID_A, (scoped) =>
      scoped.friendship.upsert({
        where: { userLow_userHigh: pairAB },
        create: {
          ...pairAB,
          status: "accepted",
          requestedBy: UID_A,
          acceptedAt: new Date(),
        },
        update: { status: "accepted", acceptedAt: new Date() },
      }),
    );

    async function createSpot(owner: string, placeId: string) {
      const collectionId = await withRls(tx, owner, async (scoped) => {
        const collection = await scoped.collection.create({
          data: {
            ownerId: owner,
            name: `${owner} collection`,
            visibility: "friends",
          },
        });
        return collection.id;
      });

      await withRls(tx, owner, (scoped) =>
        scoped.spot.create({
          data: {
            placeId,
            addedBy: owner,
            collectionId,
            rating: Rating.again,
            comment: `${owner} spot`,
            depth: 0,
          },
        }),
      );
    }

    await createSpot(UID_A, PLACE_ID);
    await createSpot(UID_B, PLACE_ID);
    await createSpot(UID_C, PLACE_ID);

    const countForA = await countSavedInCircle(tx, UID_A, PLACE_ID);
    if (countForA !== 2) {
      throw new Error(`Expected savedCount=2 for A's circle, got ${countForA}`);
    }

    const countForC = await countSavedInCircle(tx, UID_C, PLACE_ID);
    if (countForC !== 1) {
      throw new Error(`Expected savedCount=1 for C's circle, got ${countForC}`);
    }
  });
}

async function main() {
  await verifySavedCountCircle();
  console.log("PASS: savedCount circle aggregation verified");
}

runVerifyScript(main, prisma);
