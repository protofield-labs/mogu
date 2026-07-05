/**
 * Daily recommendation verification (#42 Definition of Done).
 * Run via: DATABASE_URL=... ./scripts/verify-recommendations-rls.sh
 */
import { PrismaClient, Rating } from "@prisma/client";

import {
  buildAssertion,
  buildEvidence,
  pickDailyRecommendation,
} from "../src/lib/recommendations/pick";

const prisma = new PrismaClient();

const UID_VIEWER = "rls-reco-viewer";
const UID_FRIEND = "rls-reco-friend";
const UID_OTHER = "rls-reco-other";

type Tx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;

class Rollback extends Error {
  constructor() {
    super("rollback");
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
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

function utcTodayDate(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

async function verifyRecommendations() {
  assert(
    buildEvidence("Ken", Rating.again, 3).includes("また行きたい"),
    "evidence uses rating label",
  );

  try {
    await prisma.$transaction(async (tx) => {
      await upsertUser(tx, UID_VIEWER, "Viewer");
      await upsertUser(tx, UID_FRIEND, "Friend");
      await upsertUser(tx, UID_OTHER, "Other");

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

      const friendCollectionId = await withRls(tx, UID_FRIEND, async (scoped) => {
        const collection = await scoped.collection.create({
          data: {
            ownerId: UID_FRIEND,
            name: "Friend picks",
            visibility: "friends",
          },
        });
        return collection.id;
      });

      const friendSpot = await withRls(tx, UID_FRIEND, (scoped) =>
        scoped.spot.create({
          data: {
            placeId: "ChIJseedRecoFriend01",
            addedBy: UID_FRIEND,
            collectionId: friendCollectionId,
            rating: Rating.again,
            comment: "must try",
            tagArea: "中目黒",
            tagGenre: "イタリアン",
            depth: 0,
          },
        }),
      );

      const picked = await withRls(tx, UID_VIEWER, (scoped) =>
        pickDailyRecommendation(scoped, UID_VIEWER),
      );
      assert(picked !== null, "batch picker finds friend spot");
      assert(picked!.spotId === friendSpot.id, "prefers friend again spot");
      assert(
        buildAssertion({
          ...friendSpot,
          addedByUser: { displayName: "Friend" },
        }).includes("中目黒"),
        "assertion uses structured tags",
      );

      const validDate = utcTodayDate();
      await tx.$executeRaw`
        SELECT upsert_daily_recommendation(
          ${UID_VIEWER},
          ${friendSpot.id}::uuid,
          ${picked!.assertion},
          ${picked!.evidence},
          ${validDate}::date
        )
      `;

      const recommendation = await withRls(tx, UID_VIEWER, (scoped) =>
        scoped.dailyRecommendation.findUnique({
          where: {
            userId_validDate: {
              userId: UID_VIEWER,
              validDate,
            },
          },
          select: { spotId: true, assertion: true, evidence: true },
        }),
      );
      assert(recommendation !== null, "viewer can read today's recommendation");
      assert(
        recommendation!.spotId === friendSpot.id,
        "recommendation spot matches stored row",
      );
      assert(recommendation!.assertion.length > 0, "assertion stored");
      assert(recommendation!.evidence.length > 0, "evidence stored");

      const hidden = await withRls(tx, UID_OTHER, (scoped) =>
        scoped.dailyRecommendation.findFirst({
          where: { userId: UID_VIEWER },
        }),
      );
      assert(hidden === null, "other user cannot read viewer recommendation");

      throw new Rollback();
    });
  } catch (error) {
    if (!(error instanceof Rollback)) {
      throw error;
    }
  }
}

async function main() {
  await verifyRecommendations();
  console.log("PASS: daily recommendation verified");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
