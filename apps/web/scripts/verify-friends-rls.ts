/**
 * Friends RLS verification (#37 Definition of Done).
 * Run via: DATABASE_URL=... pnpm exec tsx scripts/verify-friends-rls.ts
 *
 * All data changes run inside one transaction and are rolled back.
 */
import { PrismaClient } from "@prisma/client";

import { createRlsHarness, runVerifyScript } from "./test-helpers/rls-harness";

const prisma = new PrismaClient();
const {
  withRls,
  upsertUser,
  runInRollbackTransaction,
  resolveFriendshipPair,
} = createRlsHarness(prisma);

const UID_A = "rls-friends-user-a";
const UID_B = "rls-friends-user-b";
const UID_C = "rls-friends-user-c";

async function verifyFriendshipRlsBoundary() {
  await runInRollbackTransaction(async (tx) => {
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

    const pair = await resolveFriendshipPair(tx, UID_A, UID_B);
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
  });
}

async function verifyFriendRequestRejectDelete() {
  await runInRollbackTransaction(async (tx) => {
    await upsertUser(tx, UID_A, "RLS Friend A");
    await upsertUser(tx, UID_B, "RLS Friend B");

    const pair = await resolveFriendshipPair(tx, UID_A, UID_B);
    await withRls(tx, UID_A, (scoped) =>
      scoped.friendship.create({
        data: {
          ...pair,
          status: "pending",
          requestedBy: UID_A,
        },
      }),
    );

    await withRls(tx, UID_B, (scoped) =>
      scoped.friendship.delete({
        where: { userLow_userHigh: pair },
      }),
    );

    const remaining = await withRls(tx, UID_A, (scoped) =>
      scoped.friendship.count({ where: pair }),
    );
    if (remaining !== 0) {
      throw new Error("Recipient could not delete pending friend request");
    }

    await withRls(tx, UID_A, (scoped) =>
      scoped.friendship.create({
        data: {
          ...pair,
          status: "pending",
          requestedBy: UID_A,
        },
      }),
    );

    await withRls(tx, UID_A, (scoped) =>
      scoped.friendship.delete({
        where: { userLow_userHigh: pair },
      }),
    );

    const afterCancel = await withRls(tx, UID_B, (scoped) =>
      scoped.friendship.count({ where: pair }),
    );
    if (afterCancel !== 0) {
      throw new Error("Requester could not cancel pending friend request");
    }
  });
}

async function verifyFriendUnfriendDelete() {
  await runInRollbackTransaction(async (tx) => {
    await upsertUser(tx, UID_A, "RLS Friend A");
    await upsertUser(tx, UID_B, "RLS Friend B");
    await upsertUser(tx, UID_C, "RLS Friend C");

    const pair = await resolveFriendshipPair(tx, UID_A, UID_B);
    await withRls(tx, UID_A, (scoped) =>
      scoped.friendship.create({
        data: {
          ...pair,
          status: "accepted",
          requestedBy: UID_A,
          acceptedAt: new Date(),
        },
      }),
    );

    await withRls(tx, UID_B, (scoped) =>
      scoped.friendship.delete({
        where: { userLow_userHigh: pair },
      }),
    );

    const remaining = await withRls(tx, UID_A, (scoped) =>
      scoped.friendship.count({ where: pair }),
    );
    if (remaining !== 0) {
      throw new Error("Participant could not unfriend accepted friendship");
    }

    await withRls(tx, UID_A, (scoped) =>
      scoped.friendship.create({
        data: {
          ...pair,
          status: "accepted",
          requestedBy: UID_A,
          acceptedAt: new Date(),
        },
      }),
    );

    const outsiderDelete = await withRls(tx, UID_C, (scoped) =>
      scoped.friendship
        .delete({ where: { userLow_userHigh: pair } })
        .then(() => "deleted" as const)
        .catch(() => "denied" as const),
    );
    if (outsiderDelete !== "denied") {
      throw new Error("Non-participant must not delete friendship");
    }
  });
}

const UID_FIREBASE_LIKE = "GBguwTEai5c8DPCdbQEVu6VOXRI3";
const UID_FIREBASE_LIKE_B = "ZZZZZZZZZZZZZZZZZZZZZZZZZZZZ";

async function verifyFirebaseUidPairInsert() {
  await runInRollbackTransaction(async (tx) => {
    await upsertUser(tx, UID_FIREBASE_LIKE, "Firebase Like A");
    await upsertUser(tx, UID_FIREBASE_LIKE_B, "Firebase Like B");

    const pair = await resolveFriendshipPair(
      tx,
      UID_FIREBASE_LIKE,
      UID_FIREBASE_LIKE_B,
    );
    await withRls(tx, UID_FIREBASE_LIKE, (scoped) =>
      scoped.friendship.create({
        data: {
          ...pair,
          status: "pending",
          requestedBy: UID_FIREBASE_LIKE,
        },
      }),
    );
  });
}

async function main() {
  await verifyFriendshipRlsBoundary();
  console.log("PASS: friends RLS pending/accepted boundary verified");
  await verifyFriendRequestRejectDelete();
  console.log("PASS: friends RLS reject/cancel delete verified");
  await verifyFriendUnfriendDelete();
  console.log("PASS: friends RLS unfriend delete verified");
  await verifyFirebaseUidPairInsert();
  console.log("PASS: friends CHECK constraint with Firebase-like UIDs");
}

runVerifyScript(main, prisma);
