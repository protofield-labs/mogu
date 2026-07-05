/**
 * savedCount circle aggregation (#41 Definition of Done).
 * Run via: DATABASE_URL=... ./scripts/verify-saved-count.sh
 */
import { PrismaClient, Rating } from "@prisma/client";

const prisma = new PrismaClient();

const UID_A = "rls-savedcount-a";
const UID_B = "rls-savedcount-b";
const UID_C = "rls-savedcount-c";
const PLACE_ID = "ChIJseedSavedCountTest01";

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

async function countSavedInCircle(tx: Tx, uid: string, placeId: string) {
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
  try {
    await prisma.$transaction(async (tx) => {
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
              name: `${owner} shelf`,
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

      throw new Rollback();
    });
  } catch (error) {
    if (!(error instanceof Rollback)) {
      throw error;
    }
  }
}

async function main() {
  await verifySavedCountCircle();
  console.log("PASS: savedCount circle aggregation verified");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
