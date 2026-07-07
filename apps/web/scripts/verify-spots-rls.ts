/**
 * Spot CRUD RLS verification (#34 Definition of Done).
 * Run via: DATABASE_URL=... pnpm exec tsx scripts/verify-spots-rls.ts
 */
import { PrismaClient, Rating } from "@prisma/client";

import { createRlsHarness, runVerifyScript } from "./test-helpers/rls-harness";

const prisma = new PrismaClient();
const { withRls, upsertUser, runInRollbackTransaction, expectRlsDenied } =
  createRlsHarness(prisma);

const UID_OWNER = "rls-spots-owner";
const UID_OTHER = "rls-spots-other";

async function verifySpotCrudRls() {
  await runInRollbackTransaction(async (tx) => {
    await upsertUser(tx, UID_OWNER, "Owner");
    await upsertUser(tx, UID_OTHER, "Other");

    const ownerCollectionId = await withRls(tx, UID_OWNER, async (scoped) => {
      const collection = await scoped.collection.create({
        data: {
          ownerId: UID_OWNER,
          name: "Owner collection",
          visibility: "friends",
        },
      });
      return collection.id;
    });

    const otherCollectionId = await withRls(tx, UID_OTHER, async (scoped) => {
      const collection = await scoped.collection.create({
        data: {
          ownerId: UID_OTHER,
          name: "Other collection",
          visibility: "friends",
        },
      });
      return collection.id;
    });

    const spotId = await withRls(tx, UID_OWNER, async (scoped) => {
      const spot = await scoped.spot.create({
        data: {
          placeId: "ChIJseedSpotCrudTest01",
          addedBy: UID_OWNER,
          collectionId: ownerCollectionId,
          rating: Rating.again,
          comment: "great spot",
          depth: 0,
        },
      });
      return spot.id;
    });

    await expectRlsDenied(tx, UID_OTHER, (scoped) =>
      scoped.spot.create({
        data: {
          placeId: "ChIJseedSpotCrudTest02",
          addedBy: UID_OTHER,
          collectionId: ownerCollectionId,
          rating: Rating.either,
          comment: "intruder",
          depth: 0,
        },
      }),
    );

    await withRls(tx, UID_OWNER, (scoped) =>
      scoped.spot.update({
        where: { id: spotId },
        data: { comment: "updated", rating: Rating.no },
      }),
    );

    await expectRlsDenied(tx, UID_OTHER, (scoped) =>
      scoped.spot.update({
        where: { id: spotId },
        data: { comment: "hacked" },
      }),
    );

    await withRls(tx, UID_OWNER, (scoped) =>
      scoped.spot.delete({ where: { id: spotId } }),
    );

    const deleted = await withRls(tx, UID_OWNER, (scoped) =>
      scoped.spot.findUnique({ where: { id: spotId } }),
    );
    if (deleted) {
      throw new Error("Spot should be deleted");
    }

    await withRls(tx, UID_OTHER, (scoped) =>
      scoped.spot.create({
        data: {
          placeId: "ChIJseedSpotCrudTest03",
          addedBy: UID_OTHER,
          collectionId: otherCollectionId,
          rating: Rating.again,
          comment: "mine",
          depth: 0,
        },
      }),
    );
  });
}

async function main() {
  await verifySpotCrudRls();
  console.log("PASS: spot CRUD RLS verified");
}

runVerifyScript(main, prisma);
