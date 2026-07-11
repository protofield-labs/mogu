/**
 * Demo seed for hackathon / local dev (#46).
 * Optional env:
 *   SEED_VIEWER_UID — link demo personas to your Firebase uid (default: demo-viewer)
 */
import { PrismaClient, Rating } from "@prisma/client";

import { AGENT_PERSONA_BY_KEY } from "@/lib/agent/persona-config";
import type { DemoUserDef } from "./demo-data";
import {
  DEMO_COLLECTION_IDS,
  DEMO_PERSONAS,
  DEMO_SPOT_IDS,
  DEMO_VIEWER_DEFAULT,
} from "./demo-data";
import { DEMO_PLACE_IDS, DEMO_SHARED_PLACE_ID } from "./demo-place-ids";
import {
  enableDemoSeedContext,
  withSeedRls,
} from "./rls";
import { buildEvidence } from "@/lib/recommendations/pick";

type SeedTx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

const DEMO_RECO_EDGE_IDS = {
  viewerFromKen: "44444444-4444-4444-8444-444444444401",
  mikaFromAoi: "44444444-4444-4444-8444-444444444402",
} as const;

function buildDemoPlaceRefreshTargets(viewerUid: string) {
  return [
    {
      spotId: DEMO_SPOT_IDS.kenSharedIzakaya,
      placeId: DEMO_SHARED_PLACE_ID,
      actorUid: DEMO_PERSONAS.ken.uid,
    },
    {
      spotId: DEMO_SPOT_IDS.kenNakaCounter,
      placeId: DEMO_PLACE_IDS.kenNakaCounter,
      actorUid: DEMO_PERSONAS.ken.uid,
    },
    {
      spotId: DEMO_SPOT_IDS.kenEbisuStanding,
      placeId: DEMO_PLACE_IDS.kenEbisuStanding,
      actorUid: DEMO_PERSONAS.ken.uid,
    },
    {
      spotId: DEMO_SPOT_IDS.kenOfficeBistro,
      placeId: DEMO_PLACE_IDS.kenOfficeBistro,
      actorUid: DEMO_PERSONAS.ken.uid,
    },
    {
      spotId: DEMO_SPOT_IDS.aoiSharedQuiet,
      placeId: DEMO_SHARED_PLACE_ID,
      actorUid: DEMO_PERSONAS.aoi.uid,
    },
    {
      spotId: DEMO_SPOT_IDS.aoiNakaWine,
      placeId: DEMO_PLACE_IDS.aoiNakaWine,
      actorUid: DEMO_PERSONAS.aoi.uid,
    },
    {
      spotId: DEMO_SPOT_IDS.aoiEbisuDate,
      placeId: DEMO_PLACE_IDS.aoiEbisuDate,
      actorUid: DEMO_PERSONAS.aoi.uid,
    },
    {
      spotId: DEMO_SPOT_IDS.aoiAnniversary,
      placeId: DEMO_PLACE_IDS.aoiAnniversary,
      actorUid: DEMO_PERSONAS.aoi.uid,
    },
    {
      spotId: DEMO_SPOT_IDS.mikaSharedSpot,
      placeId: DEMO_SHARED_PLACE_ID,
      actorUid: DEMO_PERSONAS.mika.uid,
    },
    {
      spotId: DEMO_SPOT_IDS.mikaRecoFromAoi,
      placeId: DEMO_SHARED_PLACE_ID,
      actorUid: DEMO_PERSONAS.mika.uid,
    },
    {
      spotId: DEMO_SPOT_IDS.viewerRecoFromKen,
      placeId: DEMO_SHARED_PLACE_ID,
      actorUid: viewerUid,
    },
  ] as const;
}

/** Update place_id and shared-spot tags on existing demo rows (RLS-safe). */
async function refreshDemoPlaceIds(tx: SeedTx, viewerUid: string) {
  await enableDemoSeedContext(tx, viewerUid);
  await tx.$executeRaw`
    UPDATE "spots"
    SET "archived_at" = NULL,
        "updated_at" = now()
    WHERE "id"::text LIKE '22222222-2222-4222-8222-%'
  `;

  for (const target of buildDemoPlaceRefreshTargets(viewerUid)) {
    await withSeedRls(tx, target.actorUid, (scoped) =>
      scoped.spot.updateMany({
        where: { id: target.spotId },
        data: { placeId: target.placeId },
      }),
    );
  }

  // Shared SAKEBAR place_id must not keep イタリアン tags from older seeds (#317).
  const sharedIzakayaTags = {
    tagArea: "中目黒",
    tagGenre: "居酒屋",
  } as const;
  for (const target of [
    { spotId: DEMO_SPOT_IDS.aoiSharedQuiet, actorUid: DEMO_PERSONAS.aoi.uid },
    { spotId: DEMO_SPOT_IDS.mikaRecoFromAoi, actorUid: DEMO_PERSONAS.mika.uid },
  ] as const) {
    await withSeedRls(tx, target.actorUid, (scoped) =>
      scoped.spot.updateMany({
        where: { id: target.spotId, placeId: DEMO_SHARED_PLACE_ID },
        data: sharedIzakayaTags,
      }),
    );
  }
}

function resolveViewerUid(): string {
  return process.env.SEED_VIEWER_UID?.trim() || DEMO_VIEWER_DEFAULT.uid;
}

function resolveViewerProfile(viewerUid: string) {
  if (viewerUid === DEMO_VIEWER_DEFAULT.uid) {
    return DEMO_VIEWER_DEFAULT;
  }
  return {
    uid: viewerUid,
    displayName: process.env.SEED_VIEWER_NAME?.trim() || "Demo User",
    avatarColor: process.env.SEED_VIEWER_AVATAR?.trim() || "#888888",
  };
}

async function wipeDemoRows(tx: SeedTx, viewerUid: string) {
  await enableDemoSeedContext(tx, viewerUid);

  await tx.$executeRaw`
    DELETE FROM "daily_recommendations"
    WHERE "user_id" = ${viewerUid} OR "user_id" LIKE 'demo-%'
  `;
  await tx.$executeRaw`
    DELETE FROM "flags"
    WHERE "recipient_id" = ${viewerUid} OR "recipient_id" LIKE 'demo-%'
  `;
  await tx.$executeRaw`
    DELETE FROM "recollection_edges"
    WHERE "id" IN (
      ${DEMO_RECO_EDGE_IDS.viewerFromKen}::uuid,
      ${DEMO_RECO_EDGE_IDS.mikaFromAoi}::uuid
    )
  `;
  await tx.$executeRaw`
    DELETE FROM "spot_likes"
    WHERE "spot_id"::text LIKE '22222222-2222-4222-8222-%'
  `;
  await tx.$executeRaw`
    DELETE FROM "spots"
    WHERE "id"::text LIKE '22222222-2222-4222-8222-%'
       OR "collection_id"::text LIKE '11111111-1111-4111-8111-%'
  `;
  await tx.$executeRaw`
    DELETE FROM "collections"
    WHERE "id"::text LIKE '11111111-1111-4111-8111-%'
  `;
  // Users/friendships are upserted below; deleting them hits FORCE RLS on dev (#317).
}

async function upsertUser(tx: SeedTx, user: DemoUserDef) {
  await withSeedRls(tx, user.uid, (scoped) =>
    scoped.user.upsert({
      where: { firebaseUid: user.uid },
      create: {
        firebaseUid: user.uid,
        displayName: user.displayName,
        avatarColor: user.avatarColor,
      },
      update: {
        displayName: user.displayName,
        avatarColor: user.avatarColor,
      },
    }),
  );
}

async function resolveFriendshipPair(tx: SeedTx, a: string, b: string) {
  const rows = await tx.$queryRaw<{ user_low: string; user_high: string }[]>`
    SELECT LEAST(${a}::text, ${b}::text) AS user_low,
           GREATEST(${a}::text, ${b}::text) AS user_high
  `;
  const row = rows[0];
  if (!row || row.user_low === row.user_high) {
    throw new Error(`Invalid friendship pair: ${a} / ${b}`);
  }
  return { userLow: row.user_low, userHigh: row.user_high };
}

async function seedDemoDailyRecommendation(
  tx: SeedTx,
  viewerUid: string,
): Promise<void> {
  const today = new Date();
  const validDate = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
  const validDateIso = validDate.toISOString().slice(0, 10);
  const evidence = buildEvidence("Ken", Rating.again, 3);

  await enableDemoSeedContext(tx, viewerUid);
  await tx.$executeRaw`
    DELETE FROM "daily_recommendations"
    WHERE "user_id" = ${viewerUid}
      AND "valid_date" = ${validDateIso}::date
  `;
  await tx.$executeRaw`
    INSERT INTO "daily_recommendations" (
      "user_id",
      "spot_id",
      "assertion",
      "evidence",
      "valid_date"
    )
    VALUES (
      ${viewerUid},
      ${DEMO_SPOT_IDS.kenSharedIzakaya}::uuid,
      ${"今夜は中目黒のこの店がおすすめ"},
      ${evidence},
      ${validDateIso}::date
    )
  `;
}

function assertDemoSeedAllowed(): void {
  const appEnv = process.env.APP_ENV?.trim().toLowerCase();
  const nodeEnv = process.env.NODE_ENV?.trim().toLowerCase();
  const isProduction =
    appEnv === "production" || appEnv === "prod" || nodeEnv === "production";

  if (isProduction && process.env.ALLOW_PROD_SEED !== "1") {
    throw new Error(
      "Refusing to run demo seed against production. Set ALLOW_PROD_SEED=1 to override.",
    );
  }
}

export async function seedDemo(prisma: PrismaClient): Promise<void> {
  assertDemoSeedAllowed();

  const viewerUid = resolveViewerUid();
  const viewer = resolveViewerProfile(viewerUid);
  const personas = Object.values(DEMO_PERSONAS);

  console.log(`Seeding demo data (viewer=${viewerUid})…`);

  await prisma.$transaction(async (tx) => {
    await refreshDemoPlaceIds(tx, viewerUid);

    await tx.$executeRaw`SAVEPOINT demo_seed_wipe`;
    try {
      await wipeDemoRows(tx, viewerUid);
      await tx.$executeRaw`RELEASE SAVEPOINT demo_seed_wipe`;
    } catch (error) {
      await tx.$executeRaw`ROLLBACK TO SAVEPOINT demo_seed_wipe`;
      await enableDemoSeedContext(tx, viewerUid);
      console.warn(
        "WARN: demo wipe partial failure (continuing with upsert):",
        error,
      );
    }

    await upsertUser(tx, viewer);
    for (const persona of personas) {
      await upsertUser(tx, persona);
    }

    const friendships = await Promise.all([
      resolveFriendshipPair(tx, viewerUid, DEMO_PERSONAS.ken.uid),
      resolveFriendshipPair(tx, viewerUid, DEMO_PERSONAS.aoi.uid),
      resolveFriendshipPair(tx, viewerUid, DEMO_PERSONAS.mika.uid),
      resolveFriendshipPair(tx, DEMO_PERSONAS.ken.uid, DEMO_PERSONAS.aoi.uid),
    ]);

    for (const pair of friendships.slice(0, 3)) {
      await withSeedRls(tx, viewerUid, (scoped) =>
        scoped.friendship.upsert({
          where: {
            userLow_userHigh: {
              userLow: pair.userLow,
              userHigh: pair.userHigh,
            },
          },
          create: {
            ...pair,
            status: "accepted",
            requestedBy: viewerUid,
            acceptedAt: new Date(),
          },
          update: {
            status: "accepted",
            acceptedAt: new Date(),
          },
        }),
      );
    }

    const kenAoi = friendships[3]!;
    await withSeedRls(tx, DEMO_PERSONAS.ken.uid, (scoped) =>
      scoped.friendship.upsert({
        where: {
          userLow_userHigh: {
            userLow: kenAoi.userLow,
            userHigh: kenAoi.userHigh,
          },
        },
        create: {
          ...kenAoi,
          status: "accepted",
          requestedBy: DEMO_PERSONAS.ken.uid,
          acceptedAt: new Date(),
        },
        update: {
          status: "accepted",
          acceptedAt: new Date(),
        },
      }),
    );

    await withSeedRls(tx, DEMO_PERSONAS.ken.uid, (scoped) =>
      scoped.collection.createMany({
        data: [
          {
            id: DEMO_COLLECTION_IDS.kenIzakaya,
            ownerId: DEMO_PERSONAS.ken.uid,
            name: AGENT_PERSONA_BY_KEY.ken.collectionName,
            description: "会社帰りにサッと入れる店",
            visibility: "friends",
            theme: "izakaya",
          },
          {
            id: DEMO_COLLECTION_IDS.kenOffice,
            ownerId: DEMO_PERSONAS.ken.uid,
            name: "会社帰りに一杯",
            description: "軽く飲める定番",
            visibility: "friends",
            theme: "casual",
          },
        ],
        skipDuplicates: true,
      }),
    );

    await withSeedRls(tx, DEMO_PERSONAS.aoi.uid, (scoped) =>
      scoped.collection.createMany({
        data: [
          {
            id: DEMO_COLLECTION_IDS.aoiQuiet,
            ownerId: DEMO_PERSONAS.aoi.uid,
            name: AGENT_PERSONA_BY_KEY.aoi.collectionName,
            description: "会話が途切れない店",
            visibility: "friends",
            theme: "date",
          },
          {
            id: DEMO_COLLECTION_IDS.aoiAnniversary,
            ownerId: DEMO_PERSONAS.aoi.uid,
            name: "記念日候補",
            description: "特別な日に",
            visibility: "secret",
            theme: "anniversary",
          },
        ],
        skipDuplicates: true,
      }),
    );

    await enableDemoSeedContext(tx, viewerUid);
    await withSeedRls(tx, viewerUid, (scoped) =>
      scoped.collection.upsert({
        where: { id: DEMO_COLLECTION_IDS.viewerWishlist },
        create: {
          id: DEMO_COLLECTION_IDS.viewerWishlist,
          ownerId: viewerUid,
          name: "行きたいリスト",
          description: "友達のおすすめから",
          visibility: "friends",
          theme: "wishlist",
        },
        update: {
          ownerId: viewerUid,
          name: "行きたいリスト",
          description: "友達のおすすめから",
          visibility: "friends",
          theme: "wishlist",
        },
      }),
    );

    await withSeedRls(tx, DEMO_PERSONAS.mika.uid, (scoped) =>
      scoped.collection.upsert({
        where: { id: DEMO_COLLECTION_IDS.mikaCasual },
        create: {
          id: DEMO_COLLECTION_IDS.mikaCasual,
          ownerId: DEMO_PERSONAS.mika.uid,
          name: "今週行きたい",
          visibility: "friends",
          theme: "casual",
        },
        update: {
          ownerId: DEMO_PERSONAS.mika.uid,
          name: "今週行きたい",
          visibility: "friends",
          theme: "casual",
        },
      }),
    );

    await withSeedRls(tx, DEMO_PERSONAS.ken.uid, (scoped) =>
      scoped.spot.createMany({
        data: [
          {
            id: DEMO_SPOT_IDS.kenSharedIzakaya,
            placeId: DEMO_SHARED_PLACE_ID,
            addedBy: DEMO_PERSONAS.ken.uid,
            collectionId: DEMO_COLLECTION_IDS.kenIzakaya,
            comment: "半個室があって会社帰りに使いやすい",
            rating: Rating.again,
            tagArea: "中目黒",
            tagGenre: "居酒屋",
            tagSituation: "サク飲み",
            freeTags: ["半個室", "3人"],
          },
          {
            id: DEMO_SPOT_IDS.kenNakaCounter,
            placeId: DEMO_PLACE_IDS.kenNakaCounter,
            addedBy: DEMO_PERSONAS.ken.uid,
            collectionId: DEMO_COLLECTION_IDS.kenIzakaya,
            comment: "カウンターで一人でも入りやすい",
            rating: Rating.either,
            tagArea: "中目黒",
            tagGenre: "居酒屋",
            tagSituation: "サク飲み",
            freeTags: ["カウンター"],
          },
          {
            id: DEMO_SPOT_IDS.kenEbisuStanding,
            placeId: DEMO_PLACE_IDS.kenEbisuStanding,
            addedBy: DEMO_PERSONAS.ken.uid,
            collectionId: DEMO_COLLECTION_IDS.kenIzakaya,
            comment: "立ち飲みでサクッと",
            rating: Rating.again,
            tagArea: "恵比寿",
            tagGenre: "立ち飲み",
            tagSituation: "サク飲み",
            freeTags: ["立ち飲み"],
          },
          {
            id: DEMO_SPOT_IDS.kenOfficeBistro,
            placeId: DEMO_PLACE_IDS.kenOfficeBistro,
            addedBy: DEMO_PERSONAS.ken.uid,
            collectionId: DEMO_COLLECTION_IDS.kenOffice,
            comment: "仕事終わりの一杯に",
            rating: Rating.again,
            tagArea: "恵比寿",
            tagGenre: "ビストロ",
            tagSituation: "会社帰り",
            freeTags: ["ワイン"],
          },
        ],
        skipDuplicates: true,
      }),
    );

    await withSeedRls(tx, DEMO_PERSONAS.aoi.uid, (scoped) =>
      scoped.spot.createMany({
        data: [
          {
            id: DEMO_SPOT_IDS.aoiSharedQuiet,
            placeId: DEMO_SHARED_PLACE_ID,
            addedBy: DEMO_PERSONAS.aoi.uid,
            collectionId: DEMO_COLLECTION_IDS.aoiQuiet,
            comment: "静かで会話が続く",
            rating: Rating.again,
            tagArea: "中目黒",
            tagGenre: "居酒屋",
            tagSituation: "デート",
            freeTags: ["静か", "2人"],
          },
          {
            id: DEMO_SPOT_IDS.aoiNakaWine,
            placeId: DEMO_PLACE_IDS.aoiNakaWine,
            addedBy: DEMO_PERSONAS.aoi.uid,
            collectionId: DEMO_COLLECTION_IDS.aoiQuiet,
            comment: "ワインが良くて落ち着く",
            rating: Rating.again,
            tagArea: "中目黒",
            tagGenre: "ワインバー",
            tagSituation: "じっくり",
            freeTags: ["ワイン"],
          },
          {
            id: DEMO_SPOT_IDS.aoiEbisuDate,
            placeId: DEMO_PLACE_IDS.aoiEbisuDate,
            addedBy: DEMO_PERSONAS.aoi.uid,
            collectionId: DEMO_COLLECTION_IDS.aoiQuiet,
            comment: "記念日前の下見に使った",
            rating: Rating.either,
            tagArea: "恵比寿",
            tagGenre: "フレンチ",
            tagSituation: "デート",
            freeTags: ["記念日"],
          },
          {
            id: DEMO_SPOT_IDS.aoiAnniversary,
            placeId: DEMO_PLACE_IDS.aoiAnniversary,
            addedBy: DEMO_PERSONAS.aoi.uid,
            collectionId: DEMO_COLLECTION_IDS.aoiAnniversary,
            comment: "記念日に使いたい",
            rating: Rating.again,
            tagArea: "恵比寿",
            tagGenre: "フレンチ",
            tagSituation: "記念日",
            freeTags: ["特別"],
          },
        ],
        skipDuplicates: true,
      }),
    );

    await withSeedRls(tx, DEMO_PERSONAS.mika.uid, (scoped) =>
      scoped.spot.createMany({
        data: [
          {
            id: DEMO_SPOT_IDS.mikaSharedSpot,
            placeId: DEMO_SHARED_PLACE_ID,
            addedBy: DEMO_PERSONAS.mika.uid,
            collectionId: DEMO_COLLECTION_IDS.mikaCasual,
            comment: "友達と行ったあの店",
            rating: Rating.again,
            tagArea: "中目黒",
            tagGenre: "居酒屋",
            tagSituation: "サク飲み",
            freeTags: ["3人"],
          },
        ],
        skipDuplicates: true,
      }),
    );

    await withSeedRls(tx, viewerUid, (scoped) =>
      scoped.spot.createMany({
        data: [
          {
            id: DEMO_SPOT_IDS.viewerRecoFromKen,
            placeId: DEMO_SHARED_PLACE_ID,
            addedBy: viewerUid,
            collectionId: DEMO_COLLECTION_IDS.viewerWishlist,
            comment: "Kenのおすすめを保存",
            rating: Rating.again,
            tagArea: "中目黒",
            tagGenre: "居酒屋",
            tagSituation: "サク飲み",
            originUserId: DEMO_PERSONAS.ken.uid,
            depth: 1,
          },
        ],
        skipDuplicates: true,
      }),
    );

    await withSeedRls(tx, viewerUid, (scoped) =>
      scoped.recollectionEdge.createMany({
        data: [
          {
            id: DEMO_RECO_EDGE_IDS.viewerFromKen,
            spotId: DEMO_SPOT_IDS.viewerRecoFromKen,
            sourceSpotId: DEMO_SPOT_IDS.kenSharedIzakaya,
            actorId: viewerUid,
            originUserId: DEMO_PERSONAS.ken.uid,
            depth: 1,
          },
        ],
        skipDuplicates: true,
      }),
    );

    const mikaCopyId = DEMO_SPOT_IDS.mikaRecoFromAoi;
    await withSeedRls(tx, DEMO_PERSONAS.mika.uid, (scoped) =>
      scoped.spot.createMany({
        data: [
          {
            id: mikaCopyId,
            placeId: DEMO_SHARED_PLACE_ID,
            addedBy: DEMO_PERSONAS.mika.uid,
            collectionId: DEMO_COLLECTION_IDS.mikaCasual,
            comment: "Aoiのおすすめを保存",
            rating: Rating.either,
            tagArea: "中目黒",
            tagGenre: "居酒屋",
            tagSituation: "デート",
            originUserId: DEMO_PERSONAS.aoi.uid,
            depth: 1,
          },
        ],
        skipDuplicates: true,
      }),
    );

    await withSeedRls(tx, DEMO_PERSONAS.mika.uid, (scoped) =>
      scoped.recollectionEdge.createMany({
        data: [
          {
            id: DEMO_RECO_EDGE_IDS.mikaFromAoi,
            spotId: mikaCopyId,
            sourceSpotId: DEMO_SPOT_IDS.aoiSharedQuiet,
            actorId: DEMO_PERSONAS.mika.uid,
            originUserId: DEMO_PERSONAS.aoi.uid,
            depth: 1,
          },
        ],
        skipDuplicates: true,
      }),
    );
  });

  try {
    await prisma.$transaction(async (tx) => {
      await seedDemoDailyRecommendation(tx, viewerUid);
    });
  } catch (error) {
    console.warn("WARN: demo daily recommendation seed failed:", error);
  }

  console.log("PASS: demo seed completed");
  console.log(`  viewer: ${viewerUid}`);
  console.log(`  personas: ${personas.map((p) => p.uid).join(", ")}`);
  console.log(
    "  tip: SEED_VIEWER_UID=<your-firebase-uid> pnpm db:seed to link your account",
  );
}
