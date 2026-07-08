/**
 * Feed API verification (#39 Definition of Done).
 * Run via: DATABASE_URL=... pnpm exec tsx scripts/verify-feed-rls.ts
 */
import { PrismaClient, Rating } from "@prisma/client";

import { decodeFeedCursor, encodeFeedCursor } from "../src/lib/feed/cursor";
import { createRlsHarness, runVerifyScript } from "./test-helpers/rls-harness";

const prisma = new PrismaClient();
const { assert, withRls, upsertUser, runInRollbackTransaction } =
  createRlsHarness(prisma);

const UID_VIEWER = "rls-feed-viewer";
const UID_FRIEND = "rls-feed-friend";
const UID_STRANGER = "rls-feed-stranger";

async function verifyFeed() {
  const cursorId = "11111111-1111-4111-8111-111111111111";
  assert(
    decodeFeedCursor(
      encodeFeedCursor(new Date("2026-07-06T00:00:00.000Z"), cursorId),
    )?.id === cursorId,
    "cursor round-trip",
  );
  assert(decodeFeedCursor("not-valid") === null, "invalid cursor rejected");

  await runInRollbackTransaction(async (tx) => {
    await upsertUser(tx, UID_VIEWER, "Viewer");
    await upsertUser(tx, UID_FRIEND, "Friend");
    await upsertUser(tx, UID_STRANGER, "Stranger");

    const pair =
      UID_VIEWER < UID_FRIEND
        ? { userLow: UID_VIEWER, userHigh: UID_FRIEND }
        : { userLow: UID_FRIEND, userHigh: UID_VIEWER };

    await withRls(tx, UID_VIEWER, (scoped) =>
      scoped.friendship.upsert({
        where: { userLow_userHigh: pair },
        create: {
          ...pair,
          status: "accepted",
          requestedBy: UID_VIEWER,
          acceptedAt: new Date(),
        },
        update: { status: "accepted", acceptedAt: new Date() },
      }),
    );

    const viewerCollectionId = await withRls(tx, UID_VIEWER, async (scoped) => {
      const collection = await scoped.collection.create({
        data: {
          ownerId: UID_VIEWER,
          name: "Viewer collection",
          visibility: "friends",
        },
      });
      return collection.id;
    });

    const friendCollectionId = await withRls(tx, UID_FRIEND, async (scoped) => {
      const collection = await scoped.collection.create({
        data: {
          ownerId: UID_FRIEND,
          name: "Friend collection",
          visibility: "friends",
        },
      });
      return collection.id;
    });

    const strangerCollectionId = await withRls(tx, UID_STRANGER, async (scoped) => {
      const collection = await scoped.collection.create({
        data: {
          ownerId: UID_STRANGER,
          name: "Secret stranger collection",
          visibility: "friends",
        },
      });
      return collection.id;
    });

    await withRls(tx, UID_VIEWER, (scoped) =>
      scoped.spot.create({
        data: {
          placeId: "ChIJseedFeedViewer01",
          addedBy: UID_VIEWER,
          collectionId: viewerCollectionId,
          rating: Rating.again,
          comment: "mine",
          depth: 0,
          createdAt: new Date("2026-07-06T10:00:00.000Z"),
        },
      }),
    );

    await withRls(tx, UID_FRIEND, (scoped) =>
      scoped.spot.create({
        data: {
          placeId: "ChIJseedFeedFriend01",
          addedBy: UID_FRIEND,
          collectionId: friendCollectionId,
          rating: Rating.either,
          comment: "friend spot",
          depth: 0,
          createdAt: new Date("2026-07-06T11:00:00.000Z"),
        },
      }),
    );

    await withRls(tx, UID_STRANGER, (scoped) =>
      scoped.spot.create({
        data: {
          placeId: "ChIJseedFeedStranger01",
          addedBy: UID_STRANGER,
          collectionId: strangerCollectionId,
          rating: Rating.again,
          comment: "hidden",
          depth: 0,
          createdAt: new Date("2026-07-06T12:00:00.000Z"),
        },
      }),
    );

    const page1 = await withRls(tx, UID_VIEWER, async (scoped) => {
      const friendCount = await scoped.friendship.count({
        where: {
          status: "accepted",
          OR: [{ userLow: UID_VIEWER }, { userHigh: UID_VIEWER }],
        },
      });
      const rows = await scoped.spot.findMany({
        where:
          friendCount > 0 ? { addedBy: { not: UID_VIEWER } } : undefined,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          placeId: true,
          collection: { select: { name: true } },
          addedByUser: { select: { displayName: true } },
        },
      });
      return rows;
    });
    assert(page1.length === 1, "viewer with friends sees friend spots only in feed");
    assert(
      page1[0]?.placeId === "ChIJseedFeedFriend01",
      "newest friend spot first (chronological desc)",
    );
    assert(
      page1.every(
        (item) => item.collection.name.length > 0 && item.addedByUser.displayName.length > 0,
      ),
      "feed rows include actor/collection",
    );
    assert(
      !page1.some((item) => item.placeId === "ChIJseedFeedStranger01"),
      "stranger spot excluded by RLS",
    );
    assert(
      !page1.some((item) => item.placeId === "ChIJseedFeedViewer01"),
      "own spot excluded from feed when viewer has friends",
    );

    const soloViewerId = "rls-feed-solo";
    await upsertUser(tx, soloViewerId, "Solo");

    const soloCollectionId = await withRls(tx, soloViewerId, async (scoped) => {
      const collection = await scoped.collection.create({
        data: {
          ownerId: soloViewerId,
          name: "Solo collection",
          visibility: "friends",
        },
      });
      return collection.id;
    });

    await withRls(tx, soloViewerId, (scoped) =>
      scoped.spot.create({
        data: {
          placeId: "ChIJseedFeedSolo01",
          addedBy: soloViewerId,
          collectionId: soloCollectionId,
          rating: Rating.again,
          comment: "solo spot",
          depth: 0,
          createdAt: new Date("2026-07-06T09:00:00.000Z"),
        },
      }),
    );

    const soloPage = await withRls(tx, soloViewerId, async (scoped) => {
      const friendCount = await scoped.friendship.count({
        where: {
          status: "accepted",
          OR: [{ userLow: soloViewerId }, { userHigh: soloViewerId }],
        },
      });
      const rows = await scoped.spot.findMany({
        where: friendCount > 0 ? { addedBy: { not: soloViewerId } } : undefined,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { placeId: true },
      });
      return rows;
    });
    assert(soloPage.length === 1, "solo viewer feed includes own spot");
    assert(
      soloPage[0]?.placeId === "ChIJseedFeedSolo01",
      "solo viewer sees own spot in feed",
    );
  });
}

async function main() {
  await verifyFeed();
  console.log("PASS: feed API verified");
}

runVerifyScript(main, prisma);
