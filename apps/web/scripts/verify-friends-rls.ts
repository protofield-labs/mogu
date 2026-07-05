/**
 * Friends RLS verification (#37 Definition of Done).
 * Run via: DATABASE_URL=... ./scripts/verify-friends-rls.sh
 *
 * All data changes run inside one transaction and are rolled back.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const UID_A = "rls-friends-user-a";
const UID_B = "rls-friends-user-b";
const UID_C = "rls-friends-user-c";

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

function friendshipPair(a: string, b: string) {
  return a < b ? { userLow: a, userHigh: b } : { userLow: b, userHigh: a };
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

async function verifyFriendshipRlsBoundary() {
  try {
    await prisma.$transaction(async (tx) => {
      await upsertUser(tx, UID_A, "RLS Friend A");
      await upsertUser(tx, UID_B, "RLS Friend B");
      await upsertUser(tx, UID_C, "RLS Friend C");

      const bCollection = await withRls(tx, UID_B, (scoped) =>
        scoped.collection.create({
          data: {
            ownerId: UID_B,
            name: "RLS friends gate",
            visibility: "friends",
          },
        }),
      );

      const visibleBeforeRequest = await withRls(tx, UID_A, (scoped) =>
        scoped.collection.count({ where: { id: bCollection.id } }),
      );
      if (visibleBeforeRequest !== 0) {
        throw new Error("Friend collection was visible before acceptance");
      }

      const pair = friendshipPair(UID_A, UID_B);
      await withRls(tx, UID_A, (scoped) =>
        scoped.friendship.upsert({
          where: { userLow_userHigh: pair },
          create: {
            ...pair,
            status: "pending",
            requestedBy: UID_A,
          },
          update: {
            status: "pending",
            requestedBy: UID_A,
            acceptedAt: null,
          },
        }),
      );

      const incomingAsB = await withRls(tx, UID_B, (scoped) =>
        scoped.friendship.count({
          where: { ...pair, status: "pending", requestedBy: UID_A },
        }),
      );
      if (incomingAsB !== 1) {
        throw new Error("Recipient could not see incoming friend request");
      }

      const visibleToC = await withRls(tx, UID_C, (scoped) =>
        scoped.friendship.count({ where: pair }),
      );
      if (visibleToC !== 0) {
        throw new Error("Non-participant could see friend request");
      }

      const visibleWhilePending = await withRls(tx, UID_A, (scoped) =>
        scoped.collection.count({ where: { id: bCollection.id } }),
      );
      if (visibleWhilePending !== 0) {
        throw new Error("Friend collection was visible while request pending");
      }

      await withRls(tx, UID_B, (scoped) =>
        scoped.friendship.update({
          where: { userLow_userHigh: pair },
          data: { status: "accepted", acceptedAt: new Date() },
        }),
      );

      const visibleAfterAccept = await withRls(tx, UID_A, (scoped) =>
        scoped.collection.count({ where: { id: bCollection.id } }),
      );
      if (visibleAfterAccept !== 1) {
        throw new Error("Friend collection was not visible after acceptance");
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
  await verifyFriendshipRlsBoundary();
  console.log("PASS: friends RLS pending/accepted boundary verified");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
