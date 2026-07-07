/**
 * Flags inbox aggregation + read (#38 Definition of Done).
 * Run via: DATABASE_URL=... pnpm exec tsx scripts/verify-flags-rls.ts
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

const UID_ORIGIN = "rls-flags-origin";
const UID_VIEWER = "rls-flags-viewer";

async function listFlagSummary(tx: RlsTx, uid: string) {
  return withRls(tx, uid, async (scoped) => {
    const rows = await scoped.$queryRaw<
      { count: bigint; is_anonymous: boolean; week_of: Date }[]
    >`
      SELECT
        count(*)::bigint AS count,
        f.is_anonymous,
        date_trunc('week', f.created_at AT TIME ZONE 'UTC')::date AS week_of
      FROM flags f
      WHERE f.recipient_id = app_current_user()
      GROUP BY date_trunc('week', f.created_at AT TIME ZONE 'UTC'), f.is_anonymous
      ORDER BY week_of DESC, f.is_anonymous ASC
    `;
    return rows.map((row) => ({
      count: Number(row.count),
      isAnonymous: row.is_anonymous,
      weekOf: row.week_of.toISOString().slice(0, 10),
    }));
  });
}

async function verifyFlagsInbox() {
  await runInRollbackTransaction(async (tx) => {
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
        update: { status: "accepted", acceptedAt: new Date() },
      }),
    );

    const originCollectionId = await withRls(tx, UID_ORIGIN, async (scoped) => {
      const collection = await scoped.collection.create({
        data: {
          ownerId: UID_ORIGIN,
          name: "Origin collection",
          visibility: "friends",
        },
      });
      return collection.id;
    });

    const sourceSpotId = await withRls(tx, UID_ORIGIN, async (scoped) => {
      const spot = await scoped.spot.create({
        data: {
          placeId: "ChIJseedFlagsTest01",
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
          name: "Viewer collection",
          visibility: "friends",
        },
      });
      return collection.id;
    });

    await withRls(tx, UID_VIEWER, async (scoped) => {
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
    });

    const summary = await listFlagSummary(tx, UID_ORIGIN);
    const named = summary.find((row) => !row.isAnonymous);
    if (!named || named.count !== 1) {
      throw new Error(`Expected one named flag summary, got ${JSON.stringify(summary)}`);
    }

    const updated = await withRls(tx, UID_ORIGIN, (scoped) =>
      scoped.flag.updateMany({
        where: { recipientId: UID_ORIGIN, readAt: null },
        data: { readAt: new Date() },
      }),
    );
    if (updated.count !== 1) {
      throw new Error(`Expected to mark 1 flag read, got ${updated.count}`);
    }

    const unread = await withRls(tx, UID_ORIGIN, (scoped) =>
      scoped.flag.count({
        where: { recipientId: UID_ORIGIN, readAt: null },
      }),
    );
    if (unread !== 0) {
      throw new Error(`Expected 0 unread flags, got ${unread}`);
    }
  });
}

async function main() {
  await verifyFlagsInbox();
  console.log("PASS: flags inbox verified");
}

runVerifyScript(main, prisma);
