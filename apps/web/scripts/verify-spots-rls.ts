/**
 * Spot CRUD RLS verification (#34 Definition of Done).
 * Run via: DATABASE_URL=... ./scripts/verify-spots-rls.sh
 */
import { PrismaClient, Rating } from "@prisma/client";

const prisma = new PrismaClient();

const UID_OWNER = "rls-spots-owner";
const UID_OTHER = "rls-spots-other";

type Tx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;

class Rollback extends Error {
  constructor() {
    super("rollback");
  }
}

async function withRls<T>(
  tx: Tx,
  uid: string,
  fn: (scoped: Tx) => Promise<T>,
): Promise<T> {
  await tx.$executeRaw`SELECT set_config('app.current_user_id', ${uid}, true)`;
  return fn(tx);
}

async function upsertUser(tx: Tx, uid: string, displayName: string) {
  await withRls(tx, uid, (scoped) =>
    scoped.user.upsert({
      where: { firebaseUid: uid },
      create: { firebaseUid: uid, displayName },
      update: { displayName },
    }),
  );
}

async function verifySpotCrudRls() {
  try {
    await prisma.$transaction(async (tx) => {
      await upsertUser(tx, UID_OWNER, "Owner");
      await upsertUser(tx, UID_OTHER, "Other");

      const ownerCollectionId = await withRls(tx, UID_OWNER, async (scoped) => {
        const collection = await scoped.collection.create({
          data: {
            ownerId: UID_OWNER,
            name: "Owner shelf",
            visibility: "friends",
          },
        });
        return collection.id;
      });

      const otherCollectionId = await withRls(tx, UID_OTHER, async (scoped) => {
        const collection = await scoped.collection.create({
          data: {
            ownerId: UID_OTHER,
            name: "Other shelf",
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

      let forbiddenInsert = false;
      try {
        await withRls(tx, UID_OTHER, (scoped) =>
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
      } catch {
        forbiddenInsert = true;
      }
      if (!forbiddenInsert) {
        throw new Error("Other user should not insert into owner collection");
      }

      await withRls(tx, UID_OWNER, (scoped) =>
        scoped.spot.update({
          where: { id: spotId },
          data: { comment: "updated", rating: Rating.no },
        }),
      );

      let forbiddenUpdate = false;
      try {
        await withRls(tx, UID_OTHER, (scoped) =>
          scoped.spot.update({
            where: { id: spotId },
            data: { comment: "hacked" },
          }),
        );
      } catch {
        forbiddenUpdate = true;
      }
      if (!forbiddenUpdate) {
        throw new Error("Other user should not update owner spot");
      }

      await withRls(tx, UID_OWNER, (scoped) =>
        scoped.spot.delete({ where: { id: spotId } }),
      );

      const deleted = await withRls(tx, UID_OWNER, (scoped) =>
        scoped.spot.findUnique({ where: { id: spotId } }),
      );
      if (deleted) {
        throw new Error("Spot should be deleted");
      }

      // Sanity: other user can still add to own collection
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

      throw new Rollback();
    });
  } catch (error) {
    if (!(error instanceof Rollback)) {
      throw error;
    }
  }
}

async function main() {
  await verifySpotCrudRls();
  console.log("PASS: spot CRUD RLS verified");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
