/**
 * Recollection RLS verification (#40 Definition of Done).
 * Run via: DATABASE_URL=... ./scripts/verify-recollect-rls.sh
 */
import { PrismaClient, Rating } from "@prisma/client";

const prisma = new PrismaClient();

const UID_ORIGIN = "rls-recollect-origin";
const UID_VIEWER = "rls-recollect-viewer";

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

async function verifyRecollectFlow() {
  try {
    await prisma.$transaction(async (tx) => {
      await upsertUser(tx, UID_ORIGIN, "Origin");
      await upsertUser(tx, UID_VIEWER, "Viewer");

      const pair =
        UID_ORIGIN < UID_VIEWER
          ? { userLow: UID_ORIGIN, userHigh: UID_VIEWER }
          : { userLow: UID_VIEWER, userHigh: UID_ORIGIN };

      await withRls(tx, UID_ORIGIN, (scoped) =>
        scoped.friendship.upsert({
          where: { userLow_userHigh: pair },
          create: {
            ...pair,
            status: "accepted",
            requestedBy: UID_ORIGIN,
            acceptedAt: new Date(),
          },
          update: {
            status: "accepted",
            acceptedAt: new Date(),
          },
        }),
      );

      const originCollectionId = await withRls(tx, UID_ORIGIN, async (scoped) => {
        const collection = await scoped.collection.create({
          data: {
            ownerId: UID_ORIGIN,
            name: "Origin shelf",
            visibility: "friends",
          },
        });
        return collection.id;
      });

      const sourceSpotId = await withRls(tx, UID_ORIGIN, async (scoped) => {
        const spot = await scoped.spot.create({
          data: {
            placeId: "ChIJseedRecollectTest01",
            addedBy: UID_ORIGIN,
            collectionId: originCollectionId,
            rating: Rating.again,
            comment: "origin spot",
            depth: 0,
          },
        });
        return spot.id;
      });

      const viewerCollectionId = await withRls(tx, UID_VIEWER, async (scoped) => {
        const collection = await scoped.collection.create({
          data: {
            ownerId: UID_VIEWER,
            name: "Viewer shelf",
            visibility: "friends",
          },
        });
        return collection.id;
      });

      const copiedSpot = await withRls(tx, UID_VIEWER, async (scoped) => {
        const source = await scoped.spot.findUnique({
          where: { id: sourceSpotId },
        });
        if (!source) {
          throw new Error("Viewer could not read source spot");
        }

        const originUserId = source.originUserId ?? source.addedBy;
        const depth = source.depth + 1;
        const created = await scoped.spot.create({
          data: {
            placeId: source.placeId,
            addedBy: UID_VIEWER,
            collectionId: viewerCollectionId,
            rating: Rating.either,
            originUserId,
            depth,
          },
        });

        await scoped.recollectionEdge.create({
          data: {
            spotId: created.id,
            sourceSpotId: source.id,
            actorId: UID_VIEWER,
            originUserId,
            depth,
          },
        });

        return created;
      });

      if (copiedSpot.depth !== 1 || copiedSpot.originUserId !== UID_ORIGIN) {
        throw new Error("Recollected spot has unexpected depth/origin");
      }

      const flags = await withRls(tx, UID_ORIGIN, (scoped) =>
        scoped.flag.findMany({
          where: { recipientId: UID_ORIGIN, spotId: copiedSpot.id },
        }),
      );
      if (flags.length !== 1 || flags[0]?.actorId !== UID_VIEWER) {
        throw new Error("Expected named flag for depth=1 recollection");
      }

      throw new Rollback();
    });
  } catch (error) {
    if (!(error instanceof Rollback)) {
      throw error;
    }
  }
}

async function main() {
  await verifyRecollectFlow();
  console.log("PASS: recollect RLS flow verified");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
